import { App, Notice, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { Api, ApiError, S, isOffline } from "./api";

/**
 * Two-way sync between the server's vault and <folder>/ in this Obsidian vault.
 *
 * Rules (design 8장·12장):
 * - Only the primary device writes to the vault and uploads edits; other devices skip sync.
 * - `shas[path]` is the server version this device last agreed on (the "base"). A local file whose
 *   hash differs from its base has user edits: the server never overwrites or deletes it (X12); it is
 *   uploaded instead and the server merges with the user's edit winning (X11).
 * - Echo blocking lives on the server (X13); locally, a file equal to its base is never uploaded.
 * - Write-ahead for local writes (X10): `pending[path]` is saved before writing and cleared after,
 *   so a crash mid-write is detected and repaired on the next start instead of being uploaded.
 * - Offline / app closed: edited paths stay in `dirty` (saved) and are retried; re-sending an upload
 *   is idempotent on the server.
 */

export interface SyncData {
  cursor: number;
  shas: Record<string, string>;
  pending: Record<string, string>;
  dirty: string[];
  deletes: Record<string, string>; // path -> base sha of a file the user deleted locally
}

export interface SyncHost {
  app: App;
  api: Api;
  folder(): string;
  data: SyncData;
  save(): Promise<void>;
  onStatus(s: SyncStatus): void;
  onDeviceInvalid(): void;
  onNotPrimary(): void;
}

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

const MAX_BYTES = 20 * 1024 * 1024;
const PUSH_DELAY_MS = 3000;

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export class SyncEngine {
  private running = false;
  private again = false;
  private pushTimer: number | null = null;
  private writing = new Set<string>();

  constructor(private h: SyncHost) {}

  // ---- paths ----

  local(rel: string): string {
    return normalizePath(`${this.h.folder()}/${rel}`);
  }

  /** Server-relative NFC path for a vault path inside <folder>/, or null if outside / ignored. */
  rel(vaultPath: string): string | null {
    const prefix = normalizePath(this.h.folder()) + "/";
    if (!vaultPath.startsWith(prefix)) return null;
    const rel = vaultPath.slice(prefix.length).normalize("NFC");
    if (!rel || rel.split("/").some((seg) => seg.startsWith("."))) return null;
    return rel;
  }

  private file(rel: string): TFile | null {
    const f = this.h.app.vault.getAbstractFileByPath(this.local(rel));
    return f instanceof TFile ? f : null;
  }

  private async hashOf(f: TFile): Promise<string> {
    return sha256Hex(await this.h.app.vault.readBinary(f));
  }

  // ---- vault events (registered by main.ts after layout ready) ----

  onModify(f: TAbstractFile) {
    if (!(f instanceof TFile) || this.writing.has(f.path)) return;
    const rel = this.rel(f.path);
    if (rel === null) return;
    this.markDirty(rel);
  }

  onDelete(f: TAbstractFile) {
    if (this.writing.has(f.path)) return;
    this.queueDelete(f.path, f instanceof TFolder);
  }

  private queueDelete(vaultPath: string, isFolder: boolean) {
    const rel = this.rel(vaultPath);
    if (rel === null) return;
    // a deleted folder: every synced file under it
    const prefix = isFolder ? rel + "/" : null;
    for (const p of Object.keys(this.h.data.shas)) {
      if (p === rel || (prefix && p.startsWith(prefix))) this.h.data.deletes[p] = this.h.data.shas[p];
    }
    this.h.data.dirty = this.h.data.dirty.filter((p) => p !== rel && !(prefix && p.startsWith(prefix)));
    void this.h.save();
    this.schedulePush();
  }

  /** A rename is a delete of the old path plus a new file (the server has no move API yet). */
  onRename(f: TAbstractFile, oldPath: string) {
    this.queueDelete(oldPath, f instanceof TFolder);
    if (f instanceof TFolder) {
      const walk = (x: TAbstractFile) => {
        if (x instanceof TFolder) x.children.forEach(walk);
        else this.onModify(x);
      };
      walk(f);
    } else {
      this.onModify(f);
    }
  }

  markDirty(rel: string) {
    if (!this.h.data.dirty.includes(rel)) this.h.data.dirty.push(rel);
    delete this.h.data.deletes[rel];
    void this.h.save();
    this.schedulePush();
  }

  private schedulePush() {
    if (this.pushTimer !== null) window.clearTimeout(this.pushTimer);
    this.pushTimer = window.setTimeout(() => {
      this.pushTimer = null;
      void this.run({ pull: false });
    }, PUSH_DELAY_MS);
  }

  cancelTimers() {
    if (this.pushTimer !== null) window.clearTimeout(this.pushTimer);
  }

  // ---- entry point ----

  /** Push local edits, then pull server changes. Serialized: a call during a run queues one more run. */
  async run(opts: { pull: boolean; push?: boolean; quiet?: boolean } = { pull: true }): Promise<number> {
    if (this.running) {
      this.again = true;
      return 0;
    }
    this.running = true;
    this.h.onStatus("syncing");
    let applied = 0;
    try {
      await this.recoverPending();
      if (opts.pull && this.h.data.cursor === 0) applied += await this.pull(); // fresh install: learn bases first
      if (opts.push !== false) await this.push();
      if (opts.pull) applied += await this.pull();
      this.h.onStatus("idle");
      if (!opts.quiet && applied > 0) new Notice(`UniNotes: ${applied}개 파일 반영`);
    } catch (e) {
      this.h.onStatus(isOffline(e) ? "offline" : "error");
      if (e instanceof ApiError && e.status === 403) this.h.onDeviceInvalid();
      if (!opts.quiet) throw e;
      console.warn("UniNotes sync failed", e);
    } finally {
      this.running = false;
      if (this.again) {
        this.again = false;
        void this.run({ ...opts, quiet: true });
      }
    }
    return applied;
  }

  /** Startup scan: files edited while Obsidian was closed (or never uploaded) become dirty. */
  async scanLocal() {
    const prefix = normalizePath(this.h.folder()) + "/";
    for (const f of this.h.app.vault.getFiles()) {
      if (!f.path.startsWith(prefix)) continue;
      const rel = this.rel(f.path);
      if (rel === null || this.h.data.pending[rel] !== undefined) continue;
      const base = this.h.data.shas[rel];
      if (base === undefined) {
        if (this.h.data.cursor > 0) this.markDirty(rel); // a new local file (fresh installs pull first)
        continue;
      }
      if ((await this.hashOf(f)) !== base) this.markDirty(rel);
    }
    // synced files that disappeared while closed
    for (const rel of Object.keys(this.h.data.shas)) {
      if (!this.file(rel) && this.h.data.pending[rel] === undefined) this.h.data.deletes[rel] = this.h.data.shas[rel];
    }
    await this.h.save();
  }

  // ---- local writes (write-ahead) ----

  private async ensureFolder(path: string) {
    const parts = path.split("/").slice(0, -1);
    let cur = "";
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      if (!this.h.app.vault.getAbstractFileByPath(cur)) {
        try {
          await this.h.app.vault.createFolder(cur);
        } catch {
          /* created concurrently */
        }
      }
    }
  }

  private async writeLocal(rel: string, data: ArrayBuffer, sha: string) {
    const lp = this.local(rel);
    this.h.data.pending[rel] = sha;
    await this.h.save();
    this.writing.add(lp);
    try {
      const f = this.file(rel);
      if (f) await this.h.app.vault.modifyBinary(f, data);
      else {
        await this.ensureFolder(lp);
        await this.h.app.vault.createBinary(lp, data);
      }
      this.h.data.shas[rel] = sha;
      delete this.h.data.pending[rel];
      this.h.data.dirty = this.h.data.dirty.filter((p) => p !== rel);
      await this.h.save();
    } finally {
      window.setTimeout(() => this.writing.delete(lp), 2000); // vault events arrive asynchronously
    }
  }

  private async trashLocal(f: TFile) {
    this.writing.add(f.path);
    try {
      await this.h.app.fileManager.trashFile(f); // follows the user's trash setting: recoverable
    } finally {
      window.setTimeout(() => this.writing.delete(f.path), 2000);
    }
  }

  /** A crash during writeLocal left `pending`: keep the file if it is complete, else fetch it again. */
  private async recoverPending() {
    for (const [rel, sha] of Object.entries(this.h.data.pending)) {
      const f = this.file(rel);
      if (f && (await this.hashOf(f)) === sha) {
        this.h.data.shas[rel] = sha;
        delete this.h.data.pending[rel];
        continue;
      }
      const got = await this.h.api.download(rel);
      if (got) await this.writeLocal(rel, got.data, got.sha ?? (await sha256Hex(got.data)));
      else delete this.h.data.pending[rel];
    }
    await this.h.save();
  }

  /** Bring one path to the server's current version, unless the user edited it locally. */
  private async refresh(rel: string, expectLocal: string | null) {
    const f = this.file(rel);
    if (f && expectLocal !== null && (await this.hashOf(f)) !== expectLocal) return; // edited meanwhile
    const got = await this.h.api.download(rel);
    if (!got) {
      if (f) await this.trashLocal(f);
      delete this.h.data.shas[rel];
      await this.h.save();
      return;
    }
    await this.writeLocal(rel, got.data, got.sha ?? (await sha256Hex(got.data)));
  }

  // ---- push ----

  private async push() {
    const d = this.h.data;
    for (const [rel, base] of Object.entries({ ...d.deletes })) {
      if (this.file(rel)) {
        delete d.deletes[rel];
        continue;
      }
      if (base) {
        const r = await this.h.api.deleteFile(rel, base);
        // conflict: the server changed it after our base -> the pull brings the new version back
        if (r.status === "conflict") new Notice(`UniNotes: ${rel} 은(는) 서버에서 바뀌어 지우지 않았습니다`);
      }
      delete d.deletes[rel];
      delete d.shas[rel];
      await this.h.save();
    }

    for (const rel of [...d.dirty]) {
      const f = this.file(rel);
      if (!f) {
        d.dirty = d.dirty.filter((p) => p !== rel);
        continue;
      }
      if (f.stat.size > MAX_BYTES) {
        d.dirty = d.dirty.filter((p) => p !== rel);
        new Notice(`UniNotes: ${rel} 은(는) 20MB를 넘어 올리지 않습니다`);
        continue;
      }
      const data = await this.h.app.vault.readBinary(f);
      const sha = await sha256Hex(data);
      const base = d.shas[rel] ?? "";
      if (sha === base) {
        d.dirty = d.dirty.filter((p) => p !== rel);
        continue;
      }
      let r: S["PushResult"];
      try {
        r = await this.h.api.upload(rel, base, data);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 400 || e.status === 413)) {
          d.dirty = d.dirty.filter((p) => p !== rel);
          new Notice(`UniNotes: ${rel} 을(를) 올리지 못했습니다 (${e.message})`);
          continue;
        }
        throw e; // offline / 403 / 5xx: keep dirty, retry later
      }
      d.dirty = d.dirty.filter((p) => p !== rel);
      switch (r.status) {
        case "ok":
          d.shas[rel] = r.sha256 ?? sha;
          break;
        case "echo":
          // identical to a version the server made: not an edit. Converge on the server's current file.
          d.shas[rel] = sha;
          if (r.sha256 !== sha) await this.refresh(rel, sha);
          break;
        case "conflict_merged":
          d.shas[rel] = sha;
          await this.refresh(rel, sha);
          new Notice(`UniNotes: ${rel} 을(를) 서버 변경과 병합했습니다 (내 수정 우선)`);
          break;
        case "conflict_copy":
          d.shas[rel] = r.sha256 ?? sha;
          new Notice(`UniNotes: ${rel} 은(는) 내 수정을 유지하고, 서버 버전을 ${r.conflict_path} 로 남겼습니다`, 10000);
          break;
        case "not_primary":
          d.dirty.push(rel);
          await this.h.save();
          this.h.onNotPrimary();
          return;
      }
      await this.h.save();
    }
  }

  // ---- pull ----

  private async pull(): Promise<number> {
    const d = this.h.data;
    let applied = 0;
    for (;;) {
      const page = await this.h.api.changes(d.cursor);
      const latest = new Map<string, S["ChangeOut"]>(); // only the newest change per path matters
      for (const c of page.changes) latest.set(c.path.normalize("NFC"), c);

      for (const [rel, c] of latest) {
        if (this.rel(this.local(rel)) === null) continue; // hidden / outside: never touch
        const f = this.file(rel);
        const base = d.shas[rel];
        if (c.op === "delete") {
          if (f) {
            if (base !== undefined && (await this.hashOf(f)) === base) {
              await this.trashLocal(f);
              applied++;
            } else {
              this.markDirty(rel); // edited here: keep it and send it back (user wins, X12)
              new Notice(`UniNotes: 서버에서 지운 ${rel} 에 내 수정이 있어 남겨 두었습니다`);
            }
          }
          delete d.shas[rel];
          continue;
        }
        if (d.deletes[rel] !== undefined) continue; // deleted here, the push handles it
        if (c.sha256 && base === c.sha256) continue;
        if (f) {
          const lsha = await this.hashOf(f);
          if (lsha === c.sha256) {
            d.shas[rel] = lsha;
            d.dirty = d.dirty.filter((p) => p !== rel);
            continue;
          }
          if (base !== undefined && lsha !== base) {
            this.markDirty(rel); // unsynced local edit: upload, the server merges
            continue;
          }
          if (base === undefined) {
            // same path, unknown history (e.g. a copy from Obsidian Sync): keep it next to the server's
            const ext = f.extension ? `.${f.extension}` : "";
            const copy = f.path.slice(0, f.path.length - ext.length) + ` (이 기기 사본 ${stamp()})` + ext;
            await this.h.app.fileManager.renameFile(f, copy);
          }
        }
        const got = await this.h.api.download(rel);
        if (!got) continue; // gone again; a later change says so
        await this.writeLocal(rel, got.data, got.sha ?? (await sha256Hex(got.data)));
        applied++;
      }
      d.cursor = page.cursor;
      await this.h.save();
      if (!page.more) break;
    }
    try {
      await this.h.api.ack(d.cursor);
    } catch {
      /* ack is bookkeeping only */
    }
    return applied;
  }
}
