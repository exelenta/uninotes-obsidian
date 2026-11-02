import { App, Notice, Plugin, PluginSettingTab, RequestUrlResponse, Setting, normalizePath, requestUrl } from "obsidian";

// Skeleton: pull-only sync from the server's vault into <folder>/, plus agent trigger and report.
// TODO: push local edits (PUT /api/sync/file with base_sha256), conflict UI, onboarding screen.

interface UniNotesSettings {
  serverUrl: string;
  token: string;
  folder: string;
  cursor: number;
  shas: Record<string, string>; // server sha256 of each file we last wrote, keyed by vault-relative path
}

const DEFAULT_SETTINGS: UniNotesSettings = {
  serverUrl: "https://uninotes.jpstudios.org",
  token: "",
  folder: "UniNotes",
  cursor: 0,
  shas: {},
};

interface Change {
  seq: number;
  path: string;
  op: "put" | "delete";
  sha256: string | null;
}

interface ChangesResponse {
  cursor: number;
  more: boolean;
  changes: Change[];
}

const AUTO_PULL_MS = 5 * 60 * 1000;

export default class UniNotesPlugin extends Plugin {
  settings!: UniNotesSettings;
  private pulling = false;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new UniNotesSettingTab(this.app, this));

    this.addRibbonIcon("refresh-cw", "UniNotes 동기화", () => this.pull(false));
    this.addCommand({ id: "pull", name: "서버에서 가져오기", callback: () => this.pull(false) });
    this.addCommand({ id: "process-now", name: "지금 처리 (에이전트 실행)", callback: () => this.trigger() });
    this.addCommand({ id: "last-report", name: "마지막 리포트 보기", callback: () => this.lastReport() });

    this.registerInterval(window.setInterval(() => this.pull(true), AUTO_PULL_MS));
  }

  // ---- server ----

  private async api(method: string, path: string, body?: string | ArrayBuffer): Promise<RequestUrlResponse> {
    const res = await requestUrl({
      url: this.settings.serverUrl.replace(/\/+$/, "") + path,
      method,
      headers: { Authorization: `Bearer ${this.settings.token}` },
      body,
      throw: false,
    });
    if (res.status >= 400) throw new Error(`${res.status} ${res.text.slice(0, 200)}`);
    return res;
  }

  private localPath(rel: string): string {
    return normalizePath(`${this.settings.folder}/${rel}`);
  }

  private async ensureParent(path: string) {
    const parent = path.split("/").slice(0, -1).join("/");
    if (parent && !(await this.app.vault.adapter.exists(parent))) {
      await this.app.vault.adapter.mkdir(parent);
    }
  }

  // ---- commands ----

  async pull(quiet: boolean) {
    if (!this.settings.token) {
      if (!quiet) new Notice("UniNotes: 설정에서 연결 토큰을 입력하세요");
      return;
    }
    if (this.pulling) return;
    this.pulling = true;
    const adapter = this.app.vault.adapter;
    let applied = 0;
    try {
      for (;;) {
        const res = await this.api("GET", `/api/sync/changes?since=${this.settings.cursor}`);
        const data = res.json as ChangesResponse;
        const latest = new Map<string, Change>(); // only the newest change per path matters
        for (const c of data.changes) latest.set(c.path, c);

        for (const c of latest.values()) {
          const local = this.localPath(c.path);
          if (c.op === "delete") {
            if (await adapter.exists(local)) await adapter.remove(local);
            delete this.settings.shas[c.path];
            applied++;
            continue;
          }
          if (c.sha256 && this.settings.shas[c.path] === c.sha256) continue;
          const file = await this.api("GET", `/api/sync/file?path=${encodeURIComponent(c.path)}`);
          await this.ensureParent(local);
          await adapter.writeBinary(local, file.arrayBuffer);
          this.settings.shas[c.path] = file.headers["x-content-sha256"] ?? c.sha256 ?? "";
          applied++;
        }
        this.settings.cursor = data.cursor;
        await this.saveSettings();
        if (!data.more) break;
      }
      if (!quiet || applied > 0) new Notice(`UniNotes: ${applied}개 파일 반영`);
    } catch (e) {
      if (!quiet) new Notice(`UniNotes 동기화 실패: ${(e as Error).message}`);
      console.error("UniNotes pull failed", e);
    } finally {
      this.pulling = false;
    }
  }

  async trigger() {
    try {
      const res = await this.api("POST", "/api/jobs/trigger");
      new Notice(`UniNotes: 처리 요청됨 (작업 #${(res.json as { job_id: number }).job_id})`);
    } catch (e) {
      new Notice(`UniNotes: 요청 실패 ${(e as Error).message}`);
    }
  }

  async lastReport() {
    try {
      const res = await this.api("GET", "/api/jobs/latest");
      const job = res.json as { status: string; report: string | null; error: string | null } | null;
      if (!job) return new Notice("UniNotes: 아직 처리 기록이 없습니다");
      new Notice(`UniNotes [${job.status}]\n${job.report ?? job.error ?? ""}`, 15000);
    } catch (e) {
      new Notice(`UniNotes: 조회 실패 ${(e as Error).message}`);
    }
  }

  // ---- settings ----

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
    containerEl.empty();

    new Setting(containerEl)
      .setName("서버 주소")
      .addText((t) =>
        t.setValue(this.plugin.settings.serverUrl).onChange(async (v) => {
          this.plugin.settings.serverUrl = v.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("연결 토큰")
      .setDesc("가입할 때 받은 un_… 토큰")
      .addText((t) => {
        t.inputEl.type = "password";
        t.setValue(this.plugin.settings.token).onChange(async (v) => {
          this.plugin.settings.token = v.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("UniNotes 폴더")
      .setDesc("에이전트가 관리하는 폴더. 이 밖의 노트는 건드리지 않습니다.")
      .addText((t) =>
        t.setValue(this.plugin.settings.folder).onChange(async (v) => {
          this.plugin.settings.folder = v.trim() || "UniNotes";
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("처음부터 다시 받기")
      .setDesc("동기화 기록을 지우고 서버의 파일을 전부 다시 받습니다.")
      .addButton((b) =>
        b.setButtonText("초기화").onClick(async () => {
          this.plugin.settings.cursor = 0;
          this.plugin.settings.shas = {};
          await this.plugin.saveSettings();
          await this.plugin.pull(false);
        }),
      );
  }
}
