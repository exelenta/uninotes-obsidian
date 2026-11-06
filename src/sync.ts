import { App, Notice, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { Api, ApiError, S, errorText, isOffline } from "./api";

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
 * Safety (audit 2026-11-06):
 * - The state belongs to one folder (`folder`). Another folder setting resets it (resetState) rather
 *   than reading every recorded path as deleted.
 * - The folder gone while files were synced -> nothing runs; many synced files vanishing at once ->
 *   their server deletes wait (`held`). The user confirms (approveDeletes) or gets them back
 *   (restoreDeletes).
 * - A local file without a base (fresh state, a copy from iCloud / Obsidian Sync) is compared with the
 *   server's CURRENT file, never with an older version from the feed: equal -> adopted as the base,
 *   different -> kept next to it as "(이 기기 사본 …)" (vault.rename: links elsewhere stay as they are).
 * - One path that fails (a name this OS refuses, a full disk, a 5xx for one file) is recorded in
 *   `failed` (one notice per path), and pulls retry it through `refetch`; the other paths and the
 *   feed cursor go on. Only being offline or a rejected token / device stops a run.
 */

export interface SyncData {
  folder?: string; // the folder the paths below belong to
  cursor: number;
  shas: Record<string, string>;
  pending: Record<string, string>;
  dirty: string[];
  deletes: Record<string, string>; // path -> base sha of a file the user deleted locally
  failed?: Record<string, string>; // path -> last error (notified once), cleared when the path syncs
  refetch?: string[]; // paths the next pull brings to the server's current version
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
  onHeld?(): void;
}

export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "paused";

const MAX_BYTES = 20 * 1024 * 1024;
const PUSH_DELAY_MS = 3000;
/** Server deletes wait for the user when more synced files than this vanish at once, or more than
 * this share of them (at least 3): a moved or renamed folder must never empty the server. */
const MASS_DELETE_COUNT = 10;
const MASS_DELETE_SHARE = 0.2;

export function isMassDelete(n: number, total: number): boolean {
  return n > MASS_DELETE_COUNT || (n >= 3 && n > total * MASS_DELETE_SHARE);
}

/** Errors that stop a whole run (retried later as a whole); anything else fails one path only. */
function stopsRun(e: unknown): boolean {
  return isOffline(e) || (e instanceof ApiError && (e.status === 401 || e.status === 403));
}

export function emptySync(folder: string): SyncData {
  return { folder, cursor: 0, shas: {}, pending: {}, dirty: [], deletes: {}, failed: {}, refetch: [] };
}

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
  private resetTo: string | null = null;
  private approved = new Set<string>();
  private heldNotice = "";
  /** Local deletes waiting for the user's OK before they reach the server. */
  held: string[] = [];
  /** The sync folder is missing although files were synced: nothing runs until the user decides. */
  paused = false;

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
    if (!(f instanceof TFile)) return;
    const rel = this.rel(f.path);
    if (rel === null) return;
    void this.checkDirty(rel, f);
  }

  /** The engine's own writes also fire modify/create: only a hash that differs from the base is an edit. */
  private async checkDirty(rel: string, f: TFile) {
    const base = this.h.data.shas[rel];
    if (base !== undefined && this.h.data.pending[rel] === undefined) {
      try {
        if ((await this.hashOf(f)) === base) return;
      } catch {
        return; // gone already: the delete event handles it
      }
    }
    this.markDirty(rel);
  }

  onDelete(f: TAbstractFile) {
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

  // ---- failures of one path ----

  private fail(rel: string, e: unknown, refetch = false) {
    const d = this.h.data;
    d.failed ??= {};
    const first = d.failed[rel] === undefined;
    const msg = errorText(e).slice(0, 200);
    d.failed[rel] = msg;
    if (refetch && !(d.refetch ??= []).includes(rel)) d.refetch.push(rel);
    console.warn("UniNotes: sync failed for", rel, e);
    if (first) new Notice(`UniNotes: ${rel} 을(를) 동기화하지 못했습니다 (${msg}). 다른 파일은 계속 동기화하고, 이 파일은 다음 동기화 때 다시 시도합니다.`, 10000);
    void this.h.save().catch(() => undefined);
  }

  /** The path is in sync again: forget its failure. */
  private settled(rel: string) {
    const d = this.h.data;
    if (d.dirty.includes(rel) || d.deletes[rel] !== undefined || d.pending[rel] !== undefined) return;
    if (d.failed) delete d.failed[rel];
  }

  // ---- held deletes (audit H2) ----

  private rootMissing(): boolean {
    return Object.keys(this.h.data.shas).length > 0 &&
      !(this.h.app.vault.getAbstractFileByPath(normalizePath(this.h.folder())) instanceof TFolder);
  }

  private notifyHeld() {
    if (this.held.length === 0) {
      this.heldNotice = "";
      return;
    }
    const sig = `${this.paused}:${this.held.length}`;
    if (sig === this.heldNotice) return;
    this.heldNotice = sig;
    const msg = this.paused
      ? `UniNotes: '${this.h.folder()}' 폴더가 없어 동기화를 멈췄습니다. 폴더를 옮기거나 이름을 바꿨다면 설정의 'UniNotes 폴더'를 새 위치로 바꾸세요. 서버 파일은 지우지 않았습니다 (명령 'UniNotes: 보류된 삭제 확인').`
      : `UniNotes: 동기화된 파일 ${this.held.length}개가 한꺼번에 사라져 서버에서는 지우지 않고 기다립니다. 명령 'UniNotes: 보류된 삭제 확인'에서 지울지 되살릴지 고르세요.`;
    new Notice(msg, 15000);
    this.h.onHeld?.();
  }

  /** The user confirmed the held deletes: the next run sends them. */
  approveDeletes() {
    for (const r of this.held) this.approved.add(r);
    this.held = [];
    this.paused = false;
    this.heldNotice = "";
  }

  /** The user wants the held files back: forget those deletes; the next pull fetches the server's versions. */
  async restoreDeletes() {
    const d = this.h.data;
    const refetch = new Set(d.refetch ?? []);
    for (const rel of this.held) {
      delete d.deletes[rel];
      delete d.shas[rel];
      refetch.add(rel);
    }
    d.refetch = [...refetch];
    this.held = [];
    this.paused = false;
    this.heldNotice = "";
    await this.h.save();
  }

  // ---- reset (audit H2) ----

  /**
   * Forget the sync state and start over in `folder` (the folder setting changed, or "처음부터 다시
   * 받기"). Applied between runs. The next pull compares every local file with the server's current one.
   */
  async resetState(folder: string) {
    this.resetTo = folder;
    if (!this.running) await this.applyReset();
  }

  private async applyReset() {
    if (this.resetTo === null) return;
    const d = this.h.data;
    Object.assign(d, emptySync(this.resetTo));
    this.resetTo = null;
    this.approved.clear();
    this.held = [];
    this.paused = false;
    this.heldNotice = "";
    await this.h.save();
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
      await this.applyReset();
      const d = this.h.data;
      if (this.rootMissing()) {
        // moved, renamed or deleted: every synced file looks deleted. Nothing reaches the server
        // (and no pull recreates the folder piece by piece) until the user decides.
        for (const rel of Object.keys(d.shas)) if (d.pending[rel] === undefined) d.deletes[rel] = d.shas[rel];
        const waiting = Object.keys(d.deletes).filter((r) => !this.approved.has(r));
        if (waiting.length > 0) {
          this.held = waiting;
          this.paused = true;
          await this.h.save();
          this.notifyHeld();
          this.h.onStatus("paused");
          return 0;
        }
      }
      this.paused = false;
      await this.recoverPending();
      if (opts.pull && d.cursor === 0) applied += await this.pull(); // fresh state: learn bases first
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
        if (this.h.data.cursor > 0) this.markDirty(rel); // a new local file (fresh state pulls first)
        continue;
      }
      try {
        if ((await this.hashOf(f)) !== base) this.markDirty(rel);
      } catch (e) {
        console.warn("UniNotes: cannot read", f.path, e);
      }
    }
    // synced files that disappeared while closed (the push holds them if there are many)
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

  /**
   * Write a server version locally. `expect` = the local hash this write may replace (undefined: any,
   * null: the file must not exist); if the user changed the file meanwhile, nothing is written.
   */
  private async writeLocal(rel: string, data: ArrayBuffer, sha: string, expect?: string | null): Promise<boolean> {
    const lp = this.local(rel);
    let f = this.file(rel);
    if (expect !== undefined && (f ? await this.hashOf(f) : null) !== expect) {
      if (f) this.markDirty(rel); // edited during the download: the user's version goes up instead
      return false;
    }
    this.h.data.pending[rel] = sha;
    await this.h.save();
    f = this.file(rel);
    try {
      if (f) await this.h.app.vault.modifyBinary(f, data);
      else {
        await this.ensureFolder(lp);
        await this.h.app.vault.createBinary(lp, data);
      }
    } catch (e) {
      // nothing was created: no half-written file to repair (a failed modify keeps `pending`)
      if (!f && !this.file(rel)) {
        delete this.h.data.pending[rel];
        await this.h.save();
      }
      throw e;
    }
    // the modify/create event that follows finds hash == base and uploads nothing
    this.h.data.shas[rel] = sha;
    delete this.h.data.pending[rel];
    this.h.data.dirty = this.h.data.dirty.filter((p) => p !== rel);
    await this.h.save();
    return true;
  }

  private async trashLocal(rel: string, f: TFile) {
    delete this.h.data.shas[rel]; // first, so the delete event does not queue a server delete
    await this.h.save();
    // recoverable: the user's trash setting (Obsidian 1.6.6+), else the vault's .trash folder
    const fm = this.h.app.fileManager as { trashFile?: (f: TFile) => Promise<void> };
    if (typeof fm.trashFile === "function") await fm.trashFile(f);
    else await this.h.app.vault.trash(f, false);
  }

  /** A crash during writeLocal left `pending`: keep the file if it is complete, else fetch it again. */
  private async recoverPending() {
    const d = this.h.data;
    for (const [rel, sha] of Object.entries({ ...d.pending })) {
      try {
        const f = this.file(rel);
        if (f && (await this.hashOf(f)) === sha) {
          d.shas[rel] = sha;
          delete d.pending[rel];
        } else {
          const got = await this.h.api.download(rel);
          if (got) await this.writeLocal(rel, got.data, got.sha ?? (await sha256Hex(got.data)));
          else delete d.pending[rel];
        }
        this.settled(rel);
      } catch (e) {
        if (stopsRun(e)) throw e;
        this.fail(rel, e);
      }
    }
    await this.h.save();
  }

  /** Bring one path to the server's current version, unless the user edited it locally. */
  private async refresh(rel: string, expectLocal: string | null) {
    const f = this.file(rel);
    const cur = f ? await this.hashOf(f) : null;
    if (cur !== null && expectLocal !== null && cur !== expectLocal) return; // edited meanwhile
    const got = await this.h.api.download(rel);
    if (!got) {
      if (f) await this.trashLocal(rel, f);
      delete this.h.data.shas[rel];
      await this.h.save();
      return;
    }
    await this.writeLocal(rel, got.data, got.sha ?? (await sha256Hex(got.data)), cur);
  }

  // ---- push ----

  private async push() {
    const d = this.h.data;
    for (const rel of Object.keys(d.deletes)) if (this.file(rel)) delete d.deletes[rel]; // it came back
    const waiting = Object.keys(d.deletes).filter((r) => !this.approved.has(r));
    this.held = isMassDelete(waiting.length, Object.keys(d.shas).length) ? waiting : [];
    this.notifyHeld();
    const held = new Set(this.held);

    for (const [rel, base] of Object.entries({ ...d.deletes })) {
      if (held.has(rel)) continue;
      try {
        if (base) {
          const r = await this.h.api.deleteFile(rel, base);
          if (r.status === "not_primary") {
            this.h.onNotPrimary();
            return;
          }
          // conflict: the server changed it after our base -> the pull brings the new version back
          if (r.status === "conflict") new Notice(`UniNotes: ${rel} 은(는) 서버에서 바뀌어 지우지 않았습니다`);
        }
        delete d.deletes[rel];
        delete d.shas[rel];
        this.approved.delete(rel);
        this.settled(rel);
        await this.h.save();
      } catch (e) {
        if (stopsRun(e)) throw e;
        this.fail(rel, e); // stays queued: retried on the next run
      }
    }

    for (const rel of [...d.dirty]) {
      try {
        if ((await this.pushOne(rel)) === "stop") return;
      } catch (e) {
        if (stopsRun(e)) throw e;
        this.fail(rel, e); // stays dirty: retried on the next run
      }
    }
  }

  private async pushOne(rel: string): Promise<"ok" | "stop"> {
    const d = this.h.data;
    const drop = () => (d.dirty = d.dirty.filter((p) => p !== rel));
    const f = this.file(rel);
    if (!f) {
      drop();
      return "ok";
    }
    if (f.stat.size > MAX_BYTES) {
      drop();
      new Notice(`UniNotes: ${rel} 은(는) 20MB를 넘어 올리지 않습니다`);
      return "ok";
    }
    const data = await this.h.app.vault.readBinary(f);
    const sha = await sha256Hex(data);
    const base = d.shas[rel] ?? "";
    if (sha === base) {
      drop();
      this.settled(rel);
      return "ok";
    }
    let r: S["PushResult"];
    try {
      r = await this.h.api.upload(rel, base, data);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 413)) {
        drop();
        new Notice(`UniNotes: ${rel} 을(를) 올리지 못했습니다 (${e.message})`);
        return "ok";
      }
      throw e; // offline / 403 stop the run; anything else fails this path (kept dirty)
    }
    drop();
    try {
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
          new Notice(`UniNotes: ${rel} 을(를) 서버 변경과 병합했습니다 (내 수정 우선)`);
          await this.refresh(rel, sha);
          break;
        case "conflict_copy":
          d.shas[rel] = r.sha256 ?? sha;
          new Notice(`UniNotes: ${rel} 은(는) 내 수정을 유지하고, 서버 버전을 ${r.conflict_path} 로 남겼습니다`, 10000);
          break;
        case "not_primary":
          d.dirty.push(rel);
          await this.h.save();
          this.h.onNotPrimary();
          return "stop";
      }
    } catch (e) {
      // uploaded, but the server's version could not be written here: the next pull retries it
      if (stopsRun(e)) throw e;
      this.fail(rel, e, true);
      return "ok";
    }
    this.settled(rel);
    await this.h.save();
    return "ok";
  }

  // ---- pull ----

  private async pull(): Promise<number> {
    const d = this.h.data;
    let applied = 0;
    for (const rel of [...(d.refetch ?? [])]) applied += await this.applySafely(rel, "put", null);
    for (;;) {
      const page = await this.h.api.changes(d.cursor);
      const latest = new Map<string, S["ChangeOut"]>(); // only the newest change per path matters
      for (const c of page.changes) latest.set(c.path.normalize("NFC"), c);
      for (const [rel, c] of latest) {
        if (this.rel(this.local(rel)) === null) continue; // hidden / outside: never touch
        applied += await this.applySafely(rel, c.op, c.sha256 ?? null);
      }
      d.cursor = page.cursor; // also past paths that failed: they are in `refetch`
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

  /** One path of a pull; a failure is recorded and retried by later pulls instead of stopping the feed. */
  private async applySafely(rel: string, op: string, sha: string | null): Promise<number> {
    const d = this.h.data;
    try {
      const n = (await this.applyChange(rel, op, sha)) ? 1 : 0;
      if (d.refetch?.includes(rel)) d.refetch = d.refetch.filter((p) => p !== rel);
      this.settled(rel);
      return n;
    } catch (e) {
      if (stopsRun(e)) throw e;
      this.fail(rel, e, true);
      return 0;
    }
  }

  /**
   * Apply one server change to a path. `sha` null: no feed entry, bring the path to the server's
   * current state (a retry). Returns true if a local file was written or trashed.
   */
  private async applyChange(rel: string, op: string, sha: string | null): Promise<boolean> {
    const d = this.h.data;
    const f = this.file(rel);
    const base = d.shas[rel];
    if (op === "delete") {
      let trashed = false;
      if (f) {
        if (base !== undefined && (await this.hashOf(f)) === base) {
          await this.trashLocal(rel, f);
          trashed = true;
        } else {
          this.markDirty(rel); // edited here: keep it and send it back (user wins, X12)
          new Notice(`UniNotes: 서버에서 지운 ${rel} 에 내 수정이 있어 남겨 두었습니다`);
        }
      }
      delete d.shas[rel];
      return trashed;
    }
    if (d.deletes[rel] !== undefined) return false; // deleted here, the push handles it
    if (sha && base === sha) return false;
    let local: string | null = null;
    if (f) {
      local = await this.hashOf(f);
      if (local === sha) {
        d.shas[rel] = local;
        d.dirty = d.dirty.filter((p) => p !== rel);
        return false;
      }
      if (base !== undefined && local !== base) {
        this.markDirty(rel); // unsynced local edit: upload, the server merges
        return false;
      }
    }
    const got = await this.h.api.download(rel);
    if (!got) return sha === null ? this.applyChange(rel, "delete", null) : false; // a later change says so
    const current = got.sha ?? (await sha256Hex(got.data));
    // judged against the server's CURRENT file (a feed entry may be an old version from an earlier
    // page): equal -> it is the base, nothing to write
    if (local !== null && local === current) {
      d.shas[rel] = current;
      d.dirty = d.dirty.filter((p) => p !== rel);
      await this.h.save();
      return false;
    }
    let expect: string | null = local;
    if (f && base === undefined) {
      // same path, unknown history, different content: keep it next to the server's version.
      // vault.rename, not fileManager.renameFile: links elsewhere in the vault are not rewritten.
      const ext = f.extension ? `.${f.extension}` : "";
      const copy = f.path.slice(0, f.path.length - ext.length) + ` (이 기기 사본 ${stamp()})` + ext;
      await this.h.app.vault.rename(f, copy);
      expect = null;
    }
    return this.writeLocal(rel, got.data, current, expect);
  }
}

// ---- device-local state (audit H3) ----
//
// data.json sits in the vault (.obsidian/plugins/uninotes/), and iCloud / Obsidian Sync copy it to the
// user's other devices, so nothing that identifies this install is kept there. This install keeps
//   - in localStorage (per device and vault): its nonce, device id and device name;
//   - in <plugin dir>/sync-<nonce>.json: its SyncData (too big for localStorage). Another device may
//     receive a copy of the file, but only the install with that nonce reads it.

export interface Identity {
  nonce: string;
  deviceId: string;
  deviceName: string;
  /** id read from plugin 0.2.0's data.json (possibly another device's copy): replaced, see replaceLegacyDevice */
  legacyDeviceId?: string;
}

/** Per-device fields plugin 0.2.0 kept in data.json. */
export const LEGACY_KEYS = ["deviceId", "deviceName", "cursor", "shas", "pending", "dirty", "deletes"];

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const strMap = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, x] of Object.entries(v)) if (typeof x === "string") out[k] = x;
  }
  return out;
};

function syncFrom(v: Record<string, unknown>, folder: string | undefined): SyncData {
  return {
    folder,
    cursor: typeof v.cursor === "number" && v.cursor >= 0 ? v.cursor : 0,
    shas: strMap(v.shas),
    pending: strMap(v.pending),
    dirty: strs(v.dirty),
    deletes: strMap(v.deletes),
    failed: strMap(v.failed),
    refetch: strs(v.refetch),
  };
}

function newNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export class LocalStore {
  id: Identity = { nonce: "", deviceId: "", deviceName: "" };
  private writing: Promise<void> = Promise.resolve();
  private queued: Promise<void> | null = null;

  constructor(private app: App, private dir: string) {}

  private key(): string {
    const appId = (this.app as unknown as { appId?: unknown }).appId; // per vault and device
    if (typeof appId === "string" && appId) return `uninotes-install:${appId}`;
    const ad = this.app.vault.adapter as unknown as { getBasePath?: () => string };
    return `uninotes-install:${this.app.vault.getName()}|${typeof ad.getBasePath === "function" ? ad.getBasePath() : ""}`;
  }

  private syncPath(): string {
    return normalizePath(`${this.dir}/sync-${this.id.nonce}.json`);
  }

  /**
   * This install's identity and sync state. `saved` is data.json: on the first start after plugin
   * 0.2.0 its per-device fields are taken over once (`legacy` true: the caller rewrites data.json
   * without them). A sync state recorded for another folder is reset (the folder setting changed here
   * or on another device).
   */
  async load(saved: Record<string, unknown>, folder: string): Promise<{ sync: SyncData; legacy: boolean }> {
    let known: Partial<Identity> | null = null;
    try {
      known = JSON.parse(window.localStorage.getItem(this.key()) ?? "null");
    } catch {
      known = null;
    }
    const legacy = LEGACY_KEYS.some((k) => k in saved);
    let sync: SyncData | null = null;
    if (known && str(known.nonce)) {
      this.id = { nonce: str(known.nonce), deviceId: str(known.deviceId), deviceName: str(known.deviceName) };
      if (str(known.legacyDeviceId)) this.id.legacyDeviceId = str(known.legacyDeviceId);
      sync = await this.readSync();
    } else {
      this.id = { nonce: newNonce(), deviceId: "", deviceName: "" };
      if (legacy) {
        // the sync state describes this vault's files: keep it. The device id may be a copy from
        // another device: it is only remembered to hand its role over to a registration of our own.
        sync = syncFrom(saved, folder);
        if (str(saved.deviceId)) this.id.legacyDeviceId = str(saved.deviceId);
        this.id.deviceName = str(saved.deviceName);
      }
    }
    if (!sync || (sync.folder !== undefined && sync.folder !== folder)) sync = emptySync(folder);
    sync.folder = folder;
    this.saveIdentity();
    try {
      await this.saveSync(sync);
    } catch (e) {
      console.warn("UniNotes: cannot write the sync state", e);
    }
    return { sync, legacy };
  }

  saveIdentity() {
    try {
      window.localStorage.setItem(this.key(), JSON.stringify(this.id));
    } catch (e) {
      console.warn("UniNotes: cannot save the device id", e);
    }
  }

  private async readSync(): Promise<SyncData | null> {
    const p = this.syncPath();
    try {
      if (!(await this.app.vault.adapter.exists(p))) return null;
      const v = JSON.parse(await this.app.vault.adapter.read(p)) as Record<string, unknown>;
      return syncFrom(v, typeof v.folder === "string" ? v.folder : undefined);
    } catch (e) {
      console.warn("UniNotes: sync state unreadable, starting over", e);
      return null;
    }
  }

  /** Write the sync state (serialized; calls while a write is waiting share it). */
  saveSync(sync: SyncData): Promise<void> {
    if (this.queued) return this.queued;
    const run = this.writing.then(() => {
      this.queued = null;
      return this.app.vault.adapter.write(this.syncPath(), JSON.stringify(sync));
    });
    this.queued = run;
    this.writing = run.catch(() => undefined);
    return run;
  }
}

/**
 * Plugin 0.2.0 kept the device id in data.json, which iCloud / Obsidian Sync copied to the user's other
 * devices, so they all synced as the primary. After its own registration (`newId`), an install that
 * read such an id takes over its primary role (the first device online after the update keeps
 * syncing; a later one stays secondary), and the old id is revoked: an install still using it
 * registers again instead of syncing too.
 */
export async function replaceLegacyDevice(api: Api, oldId: string, newId: string): Promise<void> {
  let list = await api.listDevices();
  if (list.primary_device_id === oldId) list = await api.setPrimary(newId);
  if (list.primary_device_id === oldId) return;
  try {
    await api.revokeDevice(oldId);
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e; // already revoked by another install
  }
}
