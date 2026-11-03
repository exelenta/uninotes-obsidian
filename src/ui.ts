import { App, Modal, Notice, Setting, TFile, moment } from "obsidian";
import { Api, ApiError, S, errorText } from "./api";

const STATUS_LABEL: Record<string, string> = {
  queued: "대기",
  running: "처리 중",
  done: "완료",
  failed: "실패",
  halted_loop: "반복 감지로 정지",
  halted_quota: "한도 초과로 정지",
  pending: "대기",
  needs_confirmation: "확인 필요",
  cancelled: "취소됨",
};

export function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s;
}

export function confirmDialog(app: App, title: string, body: string, ok = "확인"): Promise<boolean> {
  return new Promise((resolve) => {
    const m = new Modal(app);
    let answered = false;
    m.titleEl.setText(title);
    m.contentEl.createEl("p", { text: body });
    new Setting(m.contentEl)
      .addButton((b) => b.setButtonText("취소").onClick(() => m.close()))
      .addButton((b) =>
        b.setButtonText(ok).setCta().onClick(() => {
          answered = true;
          m.close();
        }),
      );
    m.onClose = () => resolve(answered);
    m.open();
  });
}

function undoSummary(r: S["UndoResult"]): string {
  let msg = `UniNotes: ${r.reverted}개 변경을 되돌렸습니다`;
  if (r.conflicts && r.conflicts.length > 0) {
    msg += `\n이후 직접 고친 ${r.conflicts.length}곳은 그대로 두었습니다:\n` +
      r.conflicts.map((c) => `· ${c.path}${c.block_key ? ` (${c.block_key})` : ""}: ${c.reason}`).join("\n");
  }
  return msg;
}

export async function undoBlock(app: App, api: Api, key: string) {
  if (!(await confirmDialog(app, "블록 되돌리기", `블록 ${key} 의 에이전트 변경을 되돌릴까요?`, "되돌리기"))) return;
  try {
    new Notice(undoSummary(await api.undoBlock(key)), 10000);
  } catch (e) {
    new Notice(`UniNotes: 되돌리기 실패 (${errorText(e)})`);
  }
}

// ---- source document of the active note (frontmatter `sources`) ----

const ID_RE = /\b[0-9a-z]{16}\b/;

/** First Goodnotes document referenced by a note's frontmatter `sources` (written by the agent). */
export function noteSource(app: App, file: TFile | null): { document_id: string; page_index?: number } | null {
  if (!file) return null;
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  const sources: unknown = fm?.sources;
  const list = Array.isArray(sources) ? sources : sources ? [sources] : [];
  for (const s of list) {
    if (typeof s === "string") {
      const id = s.match(ID_RE)?.[0];
      if (id) {
        const pg = s.match(/(?:#p|p\.?|page=)\s*(\d+)/i);
        return { document_id: id, ...(pg ? { page_index: Math.max(0, Number(pg[1]) - 1) } : {}) };
      }
    } else if (s && typeof s === "object") {
      const o = s as Record<string, unknown>;
      const id = [o.document_id, o.doc, o.id].find((v) => typeof v === "string" && ID_RE.test(v)) as string | undefined;
      if (id) {
        const pages = o.pages ?? o.page;
        const first = Array.isArray(pages) ? pages[0] : pages;
        return { document_id: id, ...(typeof first === "number" ? { page_index: Math.max(0, first - 1) } : {}) };
      }
    }
  }
  return null;
}

// ---- command input ----

export class CommandModal extends Modal {
  private text = "";
  private useTarget = true;

  constructor(app: App, private api: Api, private source: { document_id: string; page_index?: number } | null,
              private sourceLabel: string | null) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText("UniNotes 명령");
    contentEl.createEl("p", {
      cls: "uninotes-muted",
      text: "에이전트에게 보낼 명령. 손글씨 @AI 태그와 같은 방식으로 처리됩니다.",
    });
    const ta = contentEl.createEl("textarea", { cls: "uninotes-command-input", attr: { rows: "4", placeholder: "예: 이 문서 연습문제 풀이 정리해줘" } });
    ta.addEventListener("input", () => (this.text = ta.value));
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        void this.send();
      }
    });
    if (this.source) {
      new Setting(contentEl)
        .setName("현재 노트의 원본 문서를 대상으로")
        .setDesc(this.sourceLabel ?? this.source.document_id)
        .addToggle((t) => t.setValue(true).onChange((v) => (this.useTarget = v)));
    }
    new Setting(contentEl).addButton((b) => b.setButtonText("보내기 (Ctrl+Enter)").setCta().onClick(() => void this.send()));
    window.setTimeout(() => ta.focus(), 0);
  }

  private async send() {
    const text = this.text.trim();
    if (!text) return;
    const req: S["CommandCreate"] = { text, source: "plugin" };
    if (this.source && this.useTarget) req.target = { ...this.source };
    try {
      let cmd = await this.api.createCommand(req);
      if (cmd.status === "needs_confirmation") {
        const n = cmd.page_cost_estimate ?? 0;
        const ok = await confirmDialog(this.app, "처리 확인", `이 명령은 약 ${n}장을 차감합니다. 진행할까요?`, `${n}장 차감하고 진행`);
        if (!ok) return;
        cmd = await this.api.createCommand({ ...req, confirm_pages: n });
      }
      new Notice(`UniNotes: 명령 접수됨 (${statusLabel(cmd.status)})`);
      this.close();
    } catch (e) {
      new Notice(`UniNotes: 명령을 보내지 못했습니다 (${errorText(e)})`);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ---- recent session reports + undo ----

export class ReportsModal extends Modal {
  constructor(app: App, private api: Api, private consoleUrl: string) {
    super(app);
  }

  async onOpen() {
    this.titleEl.setText("UniNotes 최근 리포트");
    await this.render();
  }

  private async render() {
    const { contentEl } = this;
    contentEl.empty();
    const loading = contentEl.createEl("p", { text: "불러오는 중…", cls: "uninotes-muted" });
    let sessions: S["SessionSummary"][] | null = null;
    try {
      sessions = (await this.api.sessions(10)).sessions;
    } catch (e) {
      if (!(e instanceof ApiError && e.notImplemented)) {
        loading.setText(`불러오지 못했습니다: ${errorText(e)}`);
        return;
      }
    }
    loading.remove();
    if (sessions === null) {
      // server without /api/sessions yet: v0.3 latest job
      try {
        const job = await this.api.latestJob();
        if (!job) contentEl.createEl("p", { text: "아직 처리 기록이 없습니다." });
        else this.card(contentEl, statusLabel(job.status), job.finished_at ?? job.created_at, job.trigger, job.report ?? job.error ?? "");
      } catch (e) {
        contentEl.createEl("p", { text: `불러오지 못했습니다: ${errorText(e)}` });
      }
    } else if (sessions.length === 0) {
      contentEl.createEl("p", { text: "아직 처리 기록이 없습니다." });
    } else {
      for (const s of sessions) {
        const card = this.card(contentEl, statusLabel(s.status), s.finished_at ?? s.started_at ?? s.created_at, s.trigger,
          s.report ?? (s.stage ? `진행 단계: ${s.stage}` : ""), s.pages_charged);
        if (s.undoable) {
          new Setting(card).addButton((b) =>
            b.setButtonText("이 세션 되돌리기").setWarning().onClick(async () => {
              if (!(await confirmDialog(this.app, "세션 되돌리기", "이 세션이 바꾼 내용을 모두 되돌릴까요? 이후 직접 고친 블록은 그대로 둡니다.", "되돌리기"))) return;
              try {
                const r = await this.api.undoSession(s.id);
                new Notice(undoSummary(r), 10000);
                await this.render();
              } catch (e) {
                new Notice(`UniNotes: 되돌리기 실패 (${errorText(e)})`);
              }
            }),
          );
        }
      }
    }
    const foot = contentEl.createDiv({ cls: "uninotes-footer" });
    foot.createEl("a", { text: "웹 콘솔에서 전체 보기", href: this.consoleUrl });
  }

  private card(parent: HTMLElement, status: string, at: string, trigger: string, report: string, pages?: number): HTMLElement {
    const card = parent.createDiv({ cls: "uninotes-report" });
    const head = card.createDiv({ cls: "uninotes-report-head" });
    head.createSpan({ cls: "uninotes-badge", text: status });
    head.createSpan({ cls: "uninotes-muted", text: ` ${moment(at).format("M/D HH:mm")} · ${trigger}${pages ? ` · ${pages}장` : ""}` });
    if (report) card.createEl("p", { text: report, cls: "uninotes-report-body" });
    return card;
  }

  onClose() {
    this.contentEl.empty();
  }
}
