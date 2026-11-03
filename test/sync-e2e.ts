// End-to-end: the real SyncEngine (src/sync.ts) against a real local server, with an in-memory vault.
// Run: npm run test:e2e   (needs ../server/.venv; see test/run-e2e.mjs)
import { execFileSync } from "node:child_process";
import { strict as assert } from "node:assert";
import { Api } from "../src/api";
import { SyncData, SyncEngine } from "../src/sync";
import { App, Notice } from "./obsidian-mock";

const URL_ = process.env.E2E_URL!;
const PY = process.env.E2E_PY!;
const HELPER = process.env.E2E_HELPER!;

function helper(args: string[], input?: string): string {
  return execFileSync(PY, [HELPER, ...args], { input, encoding: "utf8" }).trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Device {
  app = new App();
  data: SyncData = { cursor: 0, shas: {}, pending: {}, dirty: [], deletes: {} };
  cfg = { serverUrl: URL_, token: "", deviceId: "" };
  api = new Api(() => this.cfg);
  engine: SyncEngine;
  constructor(token: string) {
    this.cfg.token = token;
    this.engine = new SyncEngine({
      app: this.app as any, api: this.api, folder: () => "UniNotes", data: this.data, save: async () => {},
      onStatus: () => {}, onDeviceInvalid: () => (this.cfg.deviceId = ""), onNotPrimary: () => {},
    });
    const v = this.app.vault;
    v.on("modify", (f: any) => this.engine.onModify(f));
    v.on("create", (f: any) => this.engine.onModify(f));
    v.on("delete", (f: any) => this.engine.onDelete(f));
    v.on("rename", (f: any, old: string) => this.engine.onRename(f, old));
    if (process.env.E2E_DEBUG) {
      const up = this.api.upload.bind(this.api);
      this.api.upload = async (p, b, d) => {
        const r = await up(p, b, d);
        console.log("  upload", p, r.status);
        return r;
      };
    }
  }
  async register(name: string) {
    const d = await this.api.registerDevice({ name, kind: "obsidian-desktop", client_version: "0.2.0" });
    this.cfg.deviceId = d.id;
    return d;
  }
  local(rel: string) {
    return this.app.vault.read(`UniNotes/${rel}`);
  }
  async settle() {
    await sleep(50); // let vault events land (the engine's own debounced push is not awaited here)
    this.engine.cancelTimers();
  }
  async sync() {
    await this.settle();
    return this.engine.run({ pull: true, quiet: false });
  }
}

async function serverFile(d: Device, rel: string): Promise<string | null> {
  const got = await d.api.download(rel);
  return got ? new TextDecoder().decode(got.data) : null;
}

const NOTE = `---
uninotes: note
sources: ["k3m9x2p7q4r8s1t5#p3"]
---
# 33장 전자기파

> [!source]
> 필기

> [!ai|ai-90ab] 풀이
> 답은 7.86e-26 W/m²

끝
`;

async function main() {
  const { user_id: uid, token } = JSON.parse(helper(["user", "e2e@example.com"]));
  const A = new Device(token);
  const B = new Device(token);
  assert.equal((await A.register("A")).is_primary, true);
  assert.equal((await B.register("B")).is_primary, false);
  const step = (s: string) => console.log("✓", s);

  // 1. agent result reaches the primary device
  helper(["write", uid, "물리/33장.md"], NOTE);
  assert.equal(await A.sync(), 1);
  assert.equal(A.local("물리/33장.md"), NOTE);
  step("agent note pulled to primary");

  // 2. user edits the [!ai] block -> uploaded, no echo back, no rewrite on next pull
  const n0 = Number(helper(["count", uid]));
  const mine = NOTE.replace("답은 7.86e-26 W/m²", "답은 7.86×10⁻²⁶ W/m² (내가 고침)");
  A.app.vault.userWrite("UniNotes/물리/33장.md", mine);
  await A.sync();
  assert.equal(await serverFile(A, "물리/33장.md"), mine);
  assert.equal(Number(helper(["count", uid])), n0 + 1);
  assert.equal(await A.sync(), 0); // its own change comes back in the feed: nothing rewritten
  assert.equal(Number(helper(["count", uid])), n0 + 1); // and nothing re-uploaded (no echo)
  assert.equal(A.data.dirty.length, 0);
  step("user edit uploaded once, no echo");

  // 3. agent and user change the note at the same time -> merged, user wins
  const theirs = mine + "\n> [!ai|ai-77cd] 요약\n> 새 요약\n";
  helper(["write", uid, "물리/33장.md"], theirs);
  const mine2 = mine.replace("끝", "끝 (내 메모)");
  A.app.vault.userWrite("UniNotes/물리/33장.md", mine2);
  await A.sync();
  const merged = A.local("물리/33장.md")!;
  assert.ok(merged.includes("(내 메모)") && merged.includes("ai-77cd"), merged);
  assert.equal(await serverFile(A, "물리/33장.md"), merged);
  assert.equal(A.data.dirty.length, 0);
  step("concurrent edit merged on server and applied locally");

  // 4. server deletes a file the user edited locally -> kept and re-uploaded (X12)
  helper(["write", uid, "물리/메모.md"], "agent memo\n");
  await A.sync();
  A.app.vault.userWrite("UniNotes/물리/메모.md", "agent memo\nmy line\n");
  await A.settle(); // edit noticed, but the debounced push has not run yet
  helper(["delete", uid, "물리/메모.md"]);
  await A.sync();
  assert.equal(A.local("물리/메모.md"), "agent memo\nmy line\n");
  assert.equal(await serverFile(A, "물리/메모.md"), "agent memo\nmy line\n");
  step("server delete did not remove a locally edited file");

  // 5. server deletes an untouched file -> trashed locally
  helper(["write", uid, "물리/임시.md"], "tmp\n");
  await A.sync();
  helper(["delete", uid, "물리/임시.md"]);
  await A.sync();
  assert.equal(A.local("물리/임시.md"), null);
  step("server delete of an untouched file applied");

  // 6. local delete and rename propagate
  A.app.vault.userDelete("UniNotes/물리/메모.md");
  await A.sync();
  assert.equal(await serverFile(A, "물리/메모.md"), null);
  A.app.vault.rename(new (await import("./obsidian-mock")).TFile(A.app.vault, "UniNotes/물리/33장.md"), "UniNotes/물리/33장 전자기파.md");
  await A.sync();
  assert.equal(await serverFile(A, "물리/33장.md"), null);
  assert.equal(await serverFile(A, "물리/33장 전자기파.md"), merged);
  step("local delete and rename propagated");

  // 7. crash in the middle of a local write -> repaired from the server, not uploaded
  helper(["write", uid, "물리/새.md"], "v1\n");
  A.data.pending["물리/새.md"] = "f".repeat(64);
  A.app.vault.files.set("UniNotes/물리/새.md", new TextEncoder().encode("v").buffer as ArrayBuffer); // truncated
  const before = Number(helper(["count", uid]));
  await A.sync();
  assert.equal(A.local("물리/새.md"), "v1\n");
  assert.deepEqual(A.data.pending, {});
  assert.equal(Number(helper(["count", uid])), before);
  step("interrupted local write repaired without upload");

  // 8. secondary device cannot upload
  B.app.vault.userWrite("UniNotes/물리/b.md", "from B\n");
  await B.settle();
  const r = await B.api.upload("물리/b.md", "", new TextEncoder().encode("from B\n").buffer as ArrayBuffer);
  assert.equal(r.status, "not_primary");
  assert.equal(await serverFile(A, "물리/b.md"), null);
  step("secondary device refused (not_primary)");

  // 9. offline edit is kept and sent later
  A.app.vault.userWrite("UniNotes/물리/오프라인.md", "written offline\n");
  await A.settle();
  A.cfg.serverUrl = "http://127.0.0.1:9"; // nothing listens there
  await assert.rejects(A.engine.run({ pull: true, quiet: false }));
  assert.ok(A.data.dirty.includes("물리/오프라인.md"));
  A.cfg.serverUrl = URL_;
  await A.sync();
  assert.equal(await serverFile(A, "물리/오프라인.md"), "written offline\n");
  step("offline edit uploaded after reconnect");

  // 10. a stale copy of an older server version (e.g. Obsidian Sync) is an echo, not an edit
  helper(["write", uid, "물리/버전.md"], "old\n");
  await A.sync();
  helper(["write", uid, "물리/버전.md"], "new\n");
  const stale = await A.api.upload("물리/버전.md", A.data.shas["물리/버전.md"], new TextEncoder().encode("old\n").buffer as ArrayBuffer);
  assert.equal(stale.status, "echo");
  await A.sync();
  assert.equal(A.local("물리/버전.md"), "new\n");
  step("stale server version treated as echo");

  console.log("notices:", Notice.log.join(" | "));
  console.log("e2e ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
