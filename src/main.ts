import { App, Editor, Notice, ObsidianProtocolData, Platform, Plugin, PluginSettingTab, Setting, TextComponent, normalizePath } from "obsidian";
import { Api, ApiError, S, errorText, isOffline } from "./api";
import { LocalStore, SyncData, SyncEngine, SyncStatus, replaceLegacyDevice } from "./sync";
import { CommandModal, ReportsModal, choiceDialog, confirmDialog, noteSource, statusLabel, undoBlock } from "./ui";

// UniNotes for Obsidian: two-way sync of <folder>/ with the server (primary device only), processing
// status, commands, reports, undo, source links and callout styles. Dashboard and settings live in the
// web console; this plugin stays light (design 8장).

/** data.json: shared by every device that syncs this vault's .obsidian folder (iCloud, Obsidian Sync).
 * The device id, device name and sync state belong to this install only (LocalStore in sync.ts). */
interface UniNotesSettings {
  serverUrl: string;
  token: string;
  folder: string;
  pollSeconds: number;
}

const DEFAULT_SETTINGS: UniNotesSettings = {
  serverUrl: "https://uninotes.jpstudios.org",
  token: "",
  folder: "UniNotes",
  pollSeconds: 30,
};

/** A usable sync folder path, or null (hidden folders such as .obsidian are refused). */
function cleanFolder(raw: string): string | null {
  const f = raw.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!f) return "UniNotes";
  const n = normalizePath(f);
  return n.split("/").some((seg) => !seg || seg.startsWith(".")) ? null : n;
}

function sharedSettings(saved: Record<string, unknown>): UniNotesSettings {
  const s = { ...DEFAULT_SETTINGS };
  if (typeof saved.serverUrl === "string") s.serverUrl = saved.serverUrl;
  if (typeof saved.token === "string") s.token = saved.token;
  if (typeof saved.folder === "string") s.folder = cleanFolder(saved.folder) ?? s.folder;
  if (typeof saved.pollSeconds === "number" && saved.pollSeconds >= 10) s.pollSeconds = saved.pollSeconds;
  return s;
}

/** primary: syncs both ways. secondary: commands and reports only. legacy: server without device
 * support (0.4.0 before session C ships): pull only, like plugin 0.1. */
type Role = "unknown" | "primary" | "secondary" | "legacy";

const BLOCK_HEADER = /^>\s*\[!([A-Za-z-]+)\|([a-z]+-[0-9a-z]+)\]/;

export default class UniNotesPlugin extends Plugin {
  settings!: UniNotesSettings;
  store!: LocalStore;
  syncData!: SyncData;
  api!: Api;
  sync!: SyncEngine;
  role: Role = "unknown";
  primaryName: string | null = null;
  private syncStatus: SyncStatus = "idle";
  private processing: string | null = null;
  private wasProcessing = false;
  private statusEl!: HTMLElement;
  private ticking = false;
  private pollId: number | null = null;
  /** scanLocal ran since this install last became the primary (vault events count only while primary). */
  private scanned = false;

  async onload() {
    await this.loadSettings();
    this.api = new Api(() => ({ serverUrl: this.settings.serverUrl, token: this.settings.token, deviceId: this.store.id.deviceId }));
    this.sync = new SyncEngine({
      app: this.app,
      api: this.api,
      folder: () => this.syncData.folder ?? this.settings.folder, // the folder the sync state belongs to
      data: this.syncData,
      save: () => this.store.saveSync(this.syncData),
      onStatus: (s) => {
        this.syncStatus = s;
        this.renderStatus();
      },
      onDeviceInvalid: () => {
        this.store.id.deviceId = "";
        this.store.saveIdentity();
        this.role = "unknown";
        this.scanned = false;
      },
      onNotPrimary: () => {
        this.role = "secondary";
        this.scanned = false;
        this.renderStatus();
      },
      onHeld: () => this.renderStatus(),
    });
    this.addSettingTab(new UniNotesSettingTab(this.app, this));

    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("uninotes-status", "mod-clickable");
    this.statusEl.onClickEvent(() => {
      if (this.sync.held.length > 0) void this.reviewHeld();
      else new ReportsModal(this.app, this.api, this.consoleUrl()).open();
    });
    this.renderStatus();

    this.addRibbonIcon("refresh-cw", "UniNotes 동기화", () => void this.syncNow(false));
    this.addRibbonIcon("message-square-plus", "UniNotes 명령", () => this.openCommand());

    this.addCommand({ id: "sync", name: "지금 동기화", callback: () => void this.syncNow(false) });
    this.addCommand({ id: "command", name: "명령 보내기", callback: () => this.openCommand() });
    this.addCommand({ id: "reports", name: "최근 세션 리포트", callback: () => new ReportsModal(this.app, this.api, this.consoleUrl()).open() });
    this.addCommand({ id: "undo-block", name: "커서 위치 블록 되돌리기", editorCallback: (ed) => this.undoBlockAt(ed) });
    this.addCommand({ id: "process-now", name: "지금 처리 (에이전트 실행)", callback: () => void this.trigger() });
    this.addCommand({ id: "open-console", name: "웹 콘솔 열기", callback: () => window.open(this.consoleUrl()) });
    this.addCommand({ id: "make-primary", name: "이 기기를 주 기기로 지정", callback: () => void this.makePrimary() });
    this.addCommand({ id: "held-deletes", name: "보류된 삭제 확인", callback: () => void this.reviewHeld() });

    // obsidian://uninotes-open?doc=<id>&page=<1-based>&region=x0,y0,x1,y1
    this.registerObsidianProtocolHandler("uninotes-open", (p) => void this.openSource(p));

    this.app.workspace.onLayoutReady(async () => {
      // vault events only after the initial index, or every existing file would look "created"
      this.registerEvent(this.app.vault.on("modify", (f) => this.role === "primary" && this.sync.onModify(f)));
      this.registerEvent(this.app.vault.on("create", (f) => this.role === "primary" && this.sync.onModify(f)));
      this.registerEvent(this.app.vault.on("delete", (f) => this.role === "primary" && this.sync.onDelete(f)));
      this.registerEvent(this.app.vault.on("rename", (f, old) => this.role === "primary" && this.sync.onRename(f, old)));
      await this.tick(true);
    });
    this.restartPolling();
    this.registerDomEvent(window, "online", () => void this.tick(true));
  }

  onunload() {
    this.sync?.cancelTimers();
  }

  restartPolling() {
    if (this.pollId !== null) window.clearInterval(this.pollId);
    const ms = Math.max(10, this.settings.pollSeconds) * 1000;
    this.pollId = this.registerInterval(window.setInterval(() => void this.tick(true), ms));
  }

  consoleUrl(): string {
    return this.api.base + "/console";
  }

  // ---- device and polling ----

  private deviceKind(): S["DeviceCreate"]["kind"] {
    return Platform.isMobile ? "obsidian-mobile" : "obsidian-desktop";
  }

  defaultDeviceName(): string {
    return `${Platform.isMobile ? "모바일" : "데스크톱"} · ${this.app.vault.getName()}`;
  }

  /** Register this install if needed and learn whether it is the primary device. */
  private async ensureDevice(): Promise<S["SyncState"] | null> {
    const id = this.store.id;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!id.deviceId) {
        try {
          const d = await this.api.registerDevice({
            name: id.deviceName || this.defaultDeviceName(),
            kind: this.deviceKind(),
            client_version: this.manifest.version,
          });
          id.deviceId = d.id;
          this.store.saveIdentity();
        } catch (e) {
          if (e instanceof ApiError && e.notImplemented) {
            this.role = "legacy";
            return null;
          }
          throw e;
        }
      }
      if (id.legacyDeviceId) {
        // plugin 0.2.0's id from the shared data.json: hand its role over to our own (offline: next tick)
        try {
          await replaceLegacyDevice(this.api, id.legacyDeviceId, id.deviceId);
        } catch (e) {
          if (isOffline(e)) throw e;
          console.warn("UniNotes: could not replace the old device id", e);
        }
        delete id.legacyDeviceId;
        this.store.saveIdentity();
      }
      let st: S["SyncState"];
      try {
        st = await this.api.syncState();
      } catch (e) {
        if (e instanceof ApiError && e.notImplemented) {
          this.role = "legacy";
          return null;
        }
        throw e;
      }
      if (!st.device_id) {
        id.deviceId = ""; // revoked or unknown on the server: register again
        this.store.saveIdentity();
        continue;
      }
      this.role = st.is_primary ? "primary" : "secondary";
      return st;
    }
    return null;
  }

  async tick(quiet: boolean) {
    if (!this.settings.token) {
      this.renderStatus();
      return;
    }
    if (this.ticking) return;
    this.ticking = true;
    try {
      const st = await this.ensureDevice();
      // the first time this session (or again) that this install is the primary: edits and deletes
      // made before (offline start, secondary role) had no events, the scan finds them
      if (this.role !== "primary") this.scanned = false;
      else if (!this.scanned) {
        await this.sync.scanLocal();
        this.scanned = true;
      }
      if (this.role === "primary" || this.role === "legacy") {
        const d = this.syncData;
        const behind = st === null || st.head > d.cursor;
        if (behind || d.dirty.length > 0 || Object.keys(d.deletes).length > 0 || Object.keys(d.pending).length > 0) {
          await this.sync.run({ pull: true, push: this.role === "primary", quiet: true });
        }
      }
      await this.refreshProcessing();
      if (this.syncStatus === "offline") this.syncStatus = "idle";
    } catch (e) {
      this.syncStatus = isOffline(e) ? "offline" : "error";
      if (!quiet) new Notice(`UniNotes: ${errorText(e)}`);
    } finally {
      this.ticking = false;
      this.renderStatus();
    }
  }

  /** Processing status from the latest session (or the v0.3 latest job). */
  private async refreshProcessing() {
    let active: string | null = null;
    try {
      const s = (await this.api.sessions(1)).sessions[0];
      if (s && (s.status === "queued" || s.status === "running")) active = s.stage ? `처리 중 · ${s.stage}` : statusLabel(s.status);
    } catch (e) {
      if (isOffline(e)) throw e;
      // /api/sessions not implemented (or failing) on this server: v0.3 latest job
      try {
        const j = await this.api.latestJob();
        if (j && (j.status === "queued" || j.status === "running")) active = statusLabel(j.status);
      } catch (e2) {
        if (isOffline(e2)) throw e2;
        console.warn("UniNotes: processing status unavailable", e, e2);
      }
    }
    this.processing = active;
    // a session just finished: its results are on the server now
    if (this.wasProcessing && !active && (this.role === "primary" || this.role === "legacy")) {
      await this.sync.run({ pull: true, push: this.role === "primary", quiet: true });
    }
    this.wasProcessing = active !== null;
  }

  renderStatus() {
    if (!this.statusEl) return;
    let text: string;
    let title = "UniNotes: 클릭하면 최근 리포트";
    if (!this.settings.token) text = "UniNotes: 연결 필요";
    else if (this.syncStatus === "offline") text = "UniNotes: 오프라인";
    else if (this.syncStatus === "syncing") text = "UniNotes: 동기화 중…";
    else if (this.syncStatus === "error") text = "UniNotes: 동기화 오류";
    else if (this.sync && this.sync.held.length > 0) {
      text = this.sync.paused ? "UniNotes: 폴더 없음 · 동기화 멈춤" : `UniNotes: 삭제 확인 필요 ${this.sync.held.length}개`;
      title = "클릭해서 확인: 서버에서도 지울지, 서버 파일을 다시 받을지 고릅니다";
    } else if (this.role === "secondary") {
      text = "UniNotes: 보조 기기";
      title = "이 기기는 주 기기가 아니어서 동기화하지 않습니다 (명령·리포트만). 설정에서 주 기기로 바꿀 수 있습니다.";
    } else if (this.role === "legacy") text = "UniNotes: 가져오기 전용";
    else {
      const pending = this.syncData.dirty.length + Object.keys(this.syncData.deletes).length;
      text = pending > 0 ? `UniNotes: 올릴 변경 ${pending}개` : "UniNotes: 동기화됨";
    }
    const failed = Object.keys(this.syncData?.failed ?? {});
    if (failed.length > 0 && (this.role === "primary" || this.role === "legacy")) {
      text += ` · 실패 ${failed.length}개`;
      title = `동기화하지 못한 파일 (다음 동기화 때 다시 시도): ${failed.slice(0, 5).join(", ")}`;
    }
    if (this.processing) text += ` · ${this.processing}`;
    this.statusEl.setText(text);
    this.statusEl.setAttr("aria-label", title);
  }

  // ---- actions ----

  async syncNow(quiet: boolean) {
    if (!this.settings.token) {
      new Notice("UniNotes: 설정에서 연결 토큰을 입력하세요");
      return;
    }
    try {
      await this.ensureDevice();
      if (this.role === "secondary") {
        new Notice("UniNotes: 이 기기는 주 기기가 아니어서 동기화하지 않습니다. 설정에서 주 기기로 지정할 수 있습니다.");
        return;
      }
      if (this.role === "primary" && !this.scanned) {
        await this.sync.scanLocal();
        this.scanned = true;
      }
      const n = await this.sync.run({ pull: true, push: this.role === "primary", quiet });
      if (!quiet && n === 0 && this.sync.held.length === 0) new Notice("UniNotes: 최신 상태입니다");
    } catch (e) {
      new Notice(`UniNotes 동기화 실패: ${errorText(e)}`);
    } finally {
      this.renderStatus();
    }
  }

  async makePrimary() {
    try {
      await this.ensureDevice();
      const id = this.store.id.deviceId;
      if (!id) throw new Error("서버가 기기 등록을 지원하지 않습니다");
      const list = await this.api.setPrimary(id);
      this.role = list.primary_device_id === id ? "primary" : "secondary";
      new Notice("UniNotes: 이 기기가 주 기기입니다. 동기화를 시작합니다.");
      await this.sync.scanLocal();
      this.scanned = true;
      await this.syncNow(true);
    } catch (e) {
      new Notice(`UniNotes: 주 기기 지정 실패 (${e instanceof Error && !(e instanceof ApiError) && e.message.startsWith("서버") ? e.message : errorText(e)})`);
    }
  }

  /** Many synced files vanished at once, or the folder is gone: the user decides what the server gets. */
  async reviewHeld() {
    const held = [...this.sync.held];
    if (held.length === 0) return void new Notice("UniNotes: 보류된 삭제가 없습니다");
    const n = held.length;
    const intro = this.sync.paused
      ? `'${this.settings.folder}' 폴더를 찾을 수 없어 동기화된 파일 ${n}개가 모두 사라진 것으로 보입니다. 폴더를 옮기거나 이름을 바꿨다면 이 창을 닫고 설정의 'UniNotes 폴더'를 새 위치로 바꾸세요 (서버에서는 아무것도 지우지 않았습니다).`
      : `동기화된 파일 ${n}개가 이 기기에서 한꺼번에 사라졌습니다. 서버에는 아직 남아 있습니다.`;
    const list = held.slice(0, 8).map((p) => `· ${p}`).join("\n") + (n > 8 ? `\n… 외 ${n - 8}개` : "");
    const choice = await choiceDialog(this.app, "보류된 삭제", `${intro}\n\n${list}`, [
      { value: "restore", label: "서버에서 다시 받기" },
      { value: "delete", label: `서버에서도 ${n}개 지우기`, warning: true },
    ]);
    if (choice === "delete") {
      const ok = await confirmDialog(this.app, "서버에서 지우기", `서버의 파일 ${n}개를 지웁니다. 계속할까요?`, "지우기");
      if (!ok) return;
      this.sync.approveDeletes();
    } else if (choice === "restore") {
      await this.sync.restoreDeletes();
    } else return;
    this.renderStatus();
    await this.syncNow(true);
  }

  /** The sync folder setting changed (here, or on another device through data.json). */
  async useFolder(folder: string) {
    if ((this.syncData.folder ?? folder) === folder) return;
    await this.sync.resetState(folder);
    this.scanned = false;
    new Notice(`UniNotes: 동기화 폴더가 '${folder}'(으)로 바뀌어 동기화 기록을 새로 시작합니다. 서버 파일을 이 폴더로 받고, 예전 폴더의 파일은 그대로 둡니다.`, 10000);
    void this.tick(true);
  }

  async setFolder(folder: string) {
    if (folder === this.settings.folder) return;
    this.settings.folder = folder;
    await this.saveSettings();
    await this.useFolder(folder);
  }

  openCommand() {
    if (!this.settings.token) return void new Notice("UniNotes: 설정에서 연결 토큰을 입력하세요");
    const file = this.app.workspace.getActiveFile();
    const inFolder = file ? this.sync.rel(file.path) !== null : false;
    const src = inFolder ? noteSource(this.app, file) : null;
    new CommandModal(this.app, this.api, src, src && file ? `${file.basename}${src.page_index !== undefined ? ` p.${src.page_index + 1}` : ""}` : null).open();
  }

  private undoBlockAt(ed: Editor) {
    let line = ed.getCursor().line;
    // walk up through the callout to its header line
    while (line >= 0) {
      const t = ed.getLine(line);
      const m = t.match(BLOCK_HEADER);
      if (m) return void undoBlock(this.app, this.api, m[2]);
      if (!t.startsWith(">")) break;
      line--;
    }
    new Notice("UniNotes: 커서가 UniNotes 블록(> [!ai|…]) 안에 있지 않습니다");
  }

  async trigger() {
    try {
      const r = await this.api.triggerJob();
      new Notice(`UniNotes: 처리 요청됨 (작업 #${r.job_id})`);
      this.wasProcessing = true;
    } catch (e) {
      new Notice(`UniNotes: 요청 실패 (${errorText(e)})`);
    }
  }

  /** Source link: open the Goodnotes page in the web console (browser PDF viewer, #page=N). */
  async openSource(p: ObsidianProtocolData) {
    const doc = (p.doc ?? "").trim();
    if (!doc) return void new Notice("UniNotes: 원본 링크에 문서 ID가 없습니다");
    const page = p.page ? Number(p.page) : p.page_index ? Number(p.page_index) + 1 : NaN;
    let url = this.api.base + "/console";
    try {
      let found: S["DocumentOut"] | undefined;
      for (let offset = 0; offset < 5000 && !found; offset += 500) {
        const list = await this.api.documents(offset);
        found = list.documents.find((d) => d.id === doc);
        if (offset + list.documents.length >= list.total) break;
      }
      if (!found) {
        new Notice("UniNotes: 원본 문서를 찾을 수 없습니다 (서버에서 정리되었을 수 있음)");
        return;
      }
      if (found.status !== "active") new Notice("UniNotes: 원본에서 삭제된 문서입니다. 서버 사본을 엽니다.");
      if (!found.content_stored) {
        new Notice("UniNotes: 접근 영역 밖 문서라 서버에 내용이 없습니다");
        return;
      }
      url = `${this.api.base}/files/goodnotes/${found.path.split("/").map(encodeURIComponent).join("/")}`;
      if (Number.isFinite(page) && page > 0) url += `#page=${page}`;
    } catch (e) {
      if (!(e instanceof ApiError && e.notImplemented)) return void new Notice(`UniNotes: ${errorText(e)}`);
      new Notice("UniNotes: 서버가 아직 문서 조회를 지원하지 않아 웹 콘솔을 엽니다");
    }
    window.open(url);
  }

  // ---- settings ----

  private pluginDir(): string {
    return this.manifest.dir ?? normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}`);
  }

  async loadSettings() {
    const saved = ((await this.loadData()) ?? {}) as Record<string, unknown>;
    this.settings = sharedSettings(saved);
    this.store = new LocalStore(this.app, this.pluginDir());
    const { sync, legacy } = await this.store.load(saved, this.settings.folder);
    this.syncData = sync;
    if (legacy) await this.saveSettings(); // plugin 0.2.0's per-device fields leave the shared data.json
  }

  async saveSettings() {
    await this.saveData({ ...this.settings });
  }

  /** data.json changed on disk: iCloud / Obsidian Sync brought another device's settings. */
  async onExternalSettingsChange() {
    const next = sharedSettings(((await this.loadData()) ?? {}) as Record<string, unknown>);
    const poll = next.pollSeconds !== this.settings.pollSeconds;
    Object.assign(this.settings, next);
    if (poll) this.restartPolling();
    await this.useFolder(next.folder);
    this.renderStatus();
  }
}

class UniNotesSettingTab extends PluginSettingTab {
  private folderInput: TextComponent | null = null;
  private committing = false;

  constructor(app: App, private plugin: UniNotesPlugin) {
    super(app, plugin);
  }

  hide() {
    void this.commitFolder();
  }

  /** The folder setting is applied when typing ends (Enter, leaving the field, closing the settings). */
  private async commitFolder() {
    const t = this.folderInput;
    const pl = this.plugin;
    if (!t || this.committing) return;
    const folder = cleanFolder(t.getValue());
    if (folder === pl.settings.folder) return;
    this.committing = true;
    try {
      if (folder === null) {
        new Notice("UniNotes: 그 폴더 이름은 쓸 수 없습니다 ('.'으로 시작하는 폴더 제외)");
      } else if (await confirmDialog(this.app, "UniNotes 폴더 바꾸기",
        `동기화 폴더를 '${pl.settings.folder}'에서 '${folder}'(으)로 바꿀까요? 동기화 기록을 새로 시작하고 서버 파일을 새 폴더로 받습니다. '${pl.settings.folder}'의 파일은 지우지 않습니다.`, "바꾸기")) {
        await pl.setFolder(folder);
      }
      t.setValue(pl.settings.folder);
    } finally {
      this.committing = false;
    }
  }

  display(): void {
    const { containerEl } = this;
    const pl = this.plugin;
    const s = pl.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName("서버 주소")
      .addText((t) =>
        t.setValue(s.serverUrl).onChange(async (v) => {
          s.serverUrl = v.trim();
          await pl.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("연결 토큰")
      .setDesc("웹 콘솔 온보딩에서 받은 un_… 토큰")
      .addText((t) => {
        t.inputEl.type = "password";
        t.setValue(s.token).onChange(async (v) => {
          s.token = v.trim();
          await pl.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("UniNotes 폴더")
      .setDesc("에이전트가 관리하는 폴더. 이 밖의 노트는 건드리지 않습니다. 바꾸면(Enter) 동기화 기록을 새로 시작하고 서버 파일을 새 폴더로 받습니다.")
      .addText((t) => {
        this.folderInput = t;
        t.setValue(s.folder);
        t.inputEl.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            t.inputEl.blur();
          }
        });
        t.inputEl.addEventListener("blur", () => void this.commitFolder());
      });

    containerEl.createEl("h3", { text: "이 기기" });
    const roleText: Record<Role, string> = {
      unknown: "확인 전 (토큰을 넣고 동기화하면 등록됩니다)",
      primary: "주 기기: 서버 정리 결과를 받고 내 수정을 올립니다",
      secondary: "보조 기기: 명령과 리포트만 사용합니다",
      legacy: "서버가 기기 등록을 지원하지 않아 가져오기만 합니다",
    };
    new Setting(containerEl)
      .setName("기기 이름")
      .setDesc("처음 등록할 때 쓰입니다 (이 기기에만 저장)")
      .addText((t) =>
        t.setPlaceholder(pl.defaultDeviceName()).setValue(pl.store.id.deviceName).onChange((v) => {
          pl.store.id.deviceName = v.trim();
          pl.store.saveIdentity();
        }),
      );
    new Setting(containerEl)
      .setName("역할")
      .setDesc(roleText[pl.role])
      .addButton((b) =>
        b.setButtonText("이 기기를 주 기기로").setDisabled(pl.role === "primary").onClick(async () => {
          await pl.makePrimary();
          this.display();
        }),
      );
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "여러 기기에 플러그인이 있으면 한 기기만 동기화합니다. Obsidian Sync·iCloud를 쓴다면 UniNotes 폴더를 그 동기화에서 빼는 것을 권장합니다.",
    });

    containerEl.createEl("h3", { text: "동기화" });
    new Setting(containerEl)
      .setName("상태 확인 주기 (초)")
      .setDesc("서버 변경과 처리 상태를 확인하는 간격")
      .addText((t) =>
        t.setValue(String(s.pollSeconds)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 10) {
            s.pollSeconds = Math.round(n);
            await pl.saveSettings();
            pl.restartPolling();
          }
        }),
      );
    new Setting(containerEl)
      .setName("처음부터 다시 받기")
      .setDesc("동기화 기록을 지우고 서버의 파일을 다시 받습니다. 서버와 같은 파일은 그대로 두고, 다른 파일은 '(이 기기 사본)'으로 남깁니다.")
      .addButton((b) =>
        b.setButtonText("초기화").onClick(async () => {
          await pl.sync.resetState(pl.settings.folder);
          await pl.syncNow(false);
        }),
      );

    new Setting(containerEl)
      .setName("웹 콘솔")
      .setDesc("대시보드, 설정, 사용량, 원본 파일 관리")
      .addButton((b) => b.setButtonText("열기").onClick(() => window.open(pl.consoleUrl())));
  }
}
