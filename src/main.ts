import { App, Editor, Notice, ObsidianProtocolData, Platform, Plugin, PluginSettingTab, Setting } from "obsidian";
import { Api, ApiError, S, errorText, isOffline } from "./api";
import { SyncData, SyncEngine, SyncStatus } from "./sync";
import { CommandModal, ReportsModal, noteSource, statusLabel, undoBlock } from "./ui";

// UniNotes for Obsidian: two-way sync of <folder>/ with the server (primary device only), processing
// status, commands, reports, undo, source links and callout styles. Dashboard and settings live in the
// web console; this plugin stays light (design 8장).

interface UniNotesSettings extends SyncData {
  serverUrl: string;
  token: string;
  folder: string;
  deviceId: string;
  deviceName: string;
  pollSeconds: number;
}

const DEFAULT_SETTINGS: UniNotesSettings = {
  serverUrl: "https://uninotes.jpstudios.org",
  token: "",
  folder: "UniNotes",
  deviceId: "",
  deviceName: "",
  pollSeconds: 30,
  cursor: 0,
  shas: {},
  pending: {},
  dirty: [],
  deletes: {},
};

/** primary: syncs both ways. secondary: commands and reports only. legacy: server without device
 * support (0.4.0 before session C ships): pull only, like plugin 0.1. */
type Role = "unknown" | "primary" | "secondary" | "legacy";

const BLOCK_HEADER = /^>\s*\[!([A-Za-z-]+)\|([a-z]+-[0-9a-z]+)\]/;

export default class UniNotesPlugin extends Plugin {
  settings!: UniNotesSettings;
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

  async onload() {
    await this.loadSettings();
    this.api = new Api(() => ({ serverUrl: this.settings.serverUrl, token: this.settings.token, deviceId: this.settings.deviceId }));
    this.sync = new SyncEngine({
      app: this.app,
      api: this.api,
      folder: () => this.settings.folder,
      data: this.settings,
      save: () => this.saveSettings(),
      onStatus: (s) => {
        this.syncStatus = s;
        this.renderStatus();
      },
      onDeviceInvalid: () => {
        this.settings.deviceId = "";
        this.role = "unknown";
        void this.saveSettings();
      },
      onNotPrimary: () => {
        this.role = "secondary";
        this.renderStatus();
      },
    });
    this.addSettingTab(new UniNotesSettingTab(this.app, this));

    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("uninotes-status", "mod-clickable");
    this.statusEl.onClickEvent(() => new ReportsModal(this.app, this.api, this.consoleUrl()).open());
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

    // obsidian://uninotes-open?doc=<id>&page=<1-based>&region=x0,y0,x1,y1
    this.registerObsidianProtocolHandler("uninotes-open", (p) => void this.openSource(p));

    this.app.workspace.onLayoutReady(async () => {
      // vault events only after the initial index, or every existing file would look "created"
      this.registerEvent(this.app.vault.on("modify", (f) => this.role === "primary" && this.sync.onModify(f)));
      this.registerEvent(this.app.vault.on("create", (f) => this.role === "primary" && this.sync.onModify(f)));
      this.registerEvent(this.app.vault.on("delete", (f) => this.role === "primary" && this.sync.onDelete(f)));
      this.registerEvent(this.app.vault.on("rename", (f, old) => this.role === "primary" && this.sync.onRename(f, old)));
      await this.tick(true, true);
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
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!this.settings.deviceId) {
        try {
          const d = await this.api.registerDevice({
            name: this.settings.deviceName || this.defaultDeviceName(),
            kind: this.deviceKind(),
            client_version: this.manifest.version,
          });
          this.settings.deviceId = d.id;
          await this.saveSettings();
        } catch (e) {
          if (e instanceof ApiError && e.notImplemented) {
            this.role = "legacy";
            return null;
          }
          throw e;
        }
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
        this.settings.deviceId = ""; // revoked or unknown on the server: register again
        continue;
      }
      this.role = st.is_primary ? "primary" : "secondary";
      return st;
    }
    return null;
  }

  async tick(quiet: boolean, startup = false) {
    if (!this.settings.token) {
      this.renderStatus();
      return;
    }
    if (this.ticking) return;
    this.ticking = true;
    try {
      const st = await this.ensureDevice();
      if (startup && this.role === "primary") await this.sync.scanLocal();
      if (this.role === "primary" || this.role === "legacy") {
        const d = this.settings;
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
      if (!(e instanceof ApiError && e.notImplemented)) throw e;
      const j = await this.api.latestJob();
      if (j && (j.status === "queued" || j.status === "running")) active = statusLabel(j.status);
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
    else if (this.role === "secondary") {
      text = "UniNotes: 보조 기기";
      title = "이 기기는 주 기기가 아니어서 동기화하지 않습니다 (명령·리포트만). 설정에서 주 기기로 바꿀 수 있습니다.";
    } else if (this.role === "legacy") text = "UniNotes: 가져오기 전용";
    else {
      const pending = this.settings.dirty.length + Object.keys(this.settings.deletes).length;
      text = pending > 0 ? `UniNotes: 올릴 변경 ${pending}개` : "UniNotes: 동기화됨";
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
      const n = await this.sync.run({ pull: true, push: this.role === "primary", quiet });
      if (!quiet && n === 0) new Notice("UniNotes: 최신 상태입니다");
    } catch (e) {
      new Notice(`UniNotes 동기화 실패: ${errorText(e)}`);
    } finally {
      this.renderStatus();
    }
  }

  async makePrimary() {
    try {
      await this.ensureDevice();
      if (!this.settings.deviceId) throw new Error("서버가 기기 등록을 지원하지 않습니다");
      const list = await this.api.setPrimary(this.settings.deviceId);
      this.role = list.primary_device_id === this.settings.deviceId ? "primary" : "secondary";
      new Notice("UniNotes: 이 기기가 주 기기입니다. 동기화를 시작합니다.");
      await this.sync.scanLocal();
      await this.syncNow(true);
    } catch (e) {
      new Notice(`UniNotes: 주 기기 지정 실패 (${e instanceof Error && !(e instanceof ApiError) && e.message.startsWith("서버") ? e.message : errorText(e)})`);
    }
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

  async loadSettings() {
    const saved = (await this.loadData()) ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    // fresh containers (0.1.0 settings lack them; never share DEFAULT_SETTINGS' objects)
    this.settings.shas = { ...(saved.shas ?? {}) };
    this.settings.pending = { ...(saved.pending ?? {}) };
    this.settings.deletes = { ...(saved.deletes ?? {}) };
    this.settings.dirty = [...(saved.dirty ?? [])];
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class UniNotesSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: UniNotesPlugin) {
    super(app, plugin);
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
      .setDesc("에이전트가 관리하는 폴더. 이 밖의 노트는 건드리지 않습니다. 바꾼 뒤에는 '처음부터 다시 받기'를 하세요.")
      .addText((t) =>
        t.setValue(s.folder).onChange(async (v) => {
          s.folder = v.trim().replace(/^\/+|\/+$/g, "") || "UniNotes";
          await pl.saveSettings();
        }),
      );

    containerEl.createEl("h3", { text: "이 기기" });
    const roleText: Record<Role, string> = {
      unknown: "확인 전 (토큰을 넣고 동기화하면 등록됩니다)",
      primary: "주 기기: 서버 정리 결과를 받고 내 수정을 올립니다",
      secondary: "보조 기기: 명령과 리포트만 사용합니다",
      legacy: "서버가 기기 등록을 지원하지 않아 가져오기만 합니다",
    };
    new Setting(containerEl)
      .setName("기기 이름")
      .setDesc("처음 등록할 때 쓰입니다")
      .addText((t) =>
        t.setPlaceholder(pl.defaultDeviceName()).setValue(s.deviceName).onChange(async (v) => {
          s.deviceName = v.trim();
          await pl.saveSettings();
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
      .setDesc("동기화 기록을 지우고 서버의 파일을 다시 받습니다. 이 기기에서 고친 파일은 '(이 기기 사본)'으로 남깁니다.")
      .addButton((b) =>
        b.setButtonText("초기화").onClick(async () => {
          s.cursor = 0;
          s.shas = {};
          s.pending = {};
          s.dirty = [];
          s.deletes = {};
          await pl.saveSettings();
          await pl.syncNow(false);
        }),
      );

    new Setting(containerEl)
      .setName("웹 콘솔")
      .setDesc("대시보드, 설정, 사용량, 원본 파일 관리")
      .addButton((b) => b.setButtonText("열기").onClick(() => window.open(pl.consoleUrl())));
  }
}
