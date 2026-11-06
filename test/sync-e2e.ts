// End-to-end: the real SyncEngine (src/sync.ts) against a real local server, with an in-memory vault.
// Run: npm run test:e2e   (needs ../server/.venv; see test/run-e2e.mjs)
import { execFileSync } from "node:child_process";
import { strict as assert } from "node:assert";
import { Api, ApiError } from "../src/api";
import { LocalStore, SyncData, SyncEngine, emptySync, replaceLegacyDevice, sha256Hex } from "../src/sync";
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
  data: SyncData = emptySync("UniNotes");
  cfg = { serverUrl: URL_, token: "", deviceId: "" };
  api = new Api(() => this.cfg);
  engine: SyncEngine;
  constructor(token: string) {
    this.cfg.token = token;
    this.engine = new SyncEngine({
      app: this.app as any, api: this.api, folder: () => this.data.folder ?? "UniNotes", data: this.data, save: async () => {},
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
    return this.app.vault.read(`${this.data.folder}/${rel}`);
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

  await freshStateAdoptsServerFiles(step);
  await oneFailingPathDoesNotStopSync(step);
  await movedFolderOrManyDeletesAreHeld(step);
  await offlineEditsFoundByScan(step);
  await deviceIdentityIsLocal(step);

  console.log("notices:", Notice.log.join(" | "));
  console.log("e2e ok");
}

const enc = (t: string) => new TextEncoder().encode(t).buffer as ArrayBuffer;
const user = (email: string): { user_id: string; token: string } => JSON.parse(helper(["user", email]));

// audit H4 + M20: a fresh state (reset, reinstall, files from iCloud) with more than one feed page
async function freshStateAdoptsServerFiles(step: (s: string) => void) {
  const { user_id: uid, token } = user("split@example.com");
  helper(["write", uid, "물리/n.md"], "v1\n");
  helper(["write", uid, "물리/m.md"], "server m v1\n");
  helper(["bulk", uid, "filler", "520"]); // pushes the newer versions onto the second feed page
  helper(["write", uid, "물리/n.md"], "v2 current\n");
  helper(["write", uid, "물리/m.md"], "server m v2\n");
  const D = new Device(token);
  D.app.vault.userWrite("UniNotes/물리/n.md", "v2 current\n"); // same as the server's current file
  D.app.vault.userWrite("UniNotes/물리/m.md", "edited here\n"); // really different
  D.app.vault.userWrite("UniNotes/메모.md", "[[물리/m]] 링크\n"); // a note linking to it
  await D.settle();
  await D.register("A");
  const before = Number(helper(["count", uid]));
  await D.sync();
  await D.sync();
  const copies = [...D.app.vault.files.keys()].filter((p) => p.includes("이 기기 사본"));
  assert.equal(D.local("물리/n.md"), "v2 current\n");
  assert.equal(D.data.shas["물리/n.md"], await sha256Hex(enc("v2 current\n")));
  assert.equal(copies.length, 1, copies.join(", ")); // only the file that really differs
  assert.ok(copies[0].startsWith("UniNotes/물리/m (이 기기 사본 "));
  assert.equal(D.app.vault.read(copies[0]), "edited here\n");
  assert.equal(D.local("물리/m.md"), "server m v2\n");
  assert.deepEqual(D.app.renameFileCalls, []); // vault.rename: links elsewhere are not rewritten
  assert.equal(D.local("메모.md"), "[[물리/m]] 링크\n");
  const up = Number(helper(["count", uid])) - before;
  assert.equal(up, 2, `uploads: ${up}`); // the copy and the new local note, nothing else
  step("fresh state compares with the server's current file (no spurious copies, links kept)");
}

// audit H5: one path this device cannot write, or one upload that keeps failing
async function oneFailingPathDoesNotStopSync(step: (s: string) => void) {
  const { user_id: uid, token } = user("fail@example.com");
  const D = new Device(token);
  await D.register("A");
  helper(["write", uid, "a.md"], "a\n");
  helper(["write", uid, "거부됨.md"], "x\n");
  helper(["write", uid, "c.md"], "c\n");
  D.app.vault.reject = (p) => p.includes("거부됨");
  const n0 = Notice.log.length;
  const about = (s: string) => Notice.log.slice(n0).filter((m) => m.includes(s)).length;
  assert.equal(await D.sync(), 2);
  assert.equal(D.local("c.md"), "c\n");
  assert.ok(D.data.failed!["거부됨.md"]);
  assert.deepEqual(D.data.refetch, ["거부됨.md"]);
  assert.deepEqual(D.data.pending, {});
  assert.equal(D.data.cursor, (await D.api.syncState()).head); // the feed moved past it
  helper(["write", uid, "d.md"], "d\n");
  assert.equal(await D.sync(), 1); // later changes still arrive; the retry fails quietly
  assert.equal(about("거부됨"), 1); // one notice, not one per run
  D.app.vault.reject = undefined;
  assert.equal(await D.sync(), 1); // retried
  assert.equal(D.local("거부됨.md"), "x\n");
  assert.deepEqual(D.data.failed, {});
  assert.deepEqual(D.data.refetch, []);

  const realUpload = D.api.upload.bind(D.api);
  D.api.upload = async (p, b, d) => {
    if (p === "u1.md") throw new ApiError(500, null, "500 boom");
    return realUpload(p, b, d);
  };
  D.app.vault.userWrite("UniNotes/u1.md", "one\n");
  D.app.vault.userWrite("UniNotes/u2.md", "two\n");
  helper(["write", uid, "e.md"], "e\n");
  assert.equal(await D.sync(), 1); // the pull after the failed upload still ran
  assert.equal(await serverFile(D, "u2.md"), "two\n");
  assert.equal(await serverFile(D, "u1.md"), null);
  assert.ok(D.data.dirty.includes("u1.md") && D.data.failed!["u1.md"]);
  await D.sync();
  assert.equal(about("u1.md"), 1);
  D.api.upload = realUpload;
  await D.sync();
  assert.equal(await serverFile(D, "u1.md"), "one\n");
  assert.deepEqual(D.data.failed, {});
  step("a path that fails is retried later without stopping the others");
}

// audit H2: the UniNotes folder moved, or many synced files gone at once
async function movedFolderOrManyDeletesAreHeld(step: (s: string) => void) {
  const { user_id: uid, token } = user("move@example.com");
  const D = new Device(token);
  await D.register("A");
  for (let i = 0; i < 12; i++) helper(["write", uid, `과목/${i}.md`], `note ${i}\n`);
  await D.sync();
  const deleted: string[] = [];
  const realDelete = D.api.deleteFile.bind(D.api);
  D.api.deleteFile = async (p, b) => {
    deleted.push(p);
    return realDelete(p, b);
  };

  D.app.vault.moveFolder("UniNotes", "보관/UniNotes");
  await D.sync();
  assert.equal(deleted.length, 0);
  assert.ok(D.engine.paused);
  assert.equal(D.engine.held.length, 12);
  assert.equal(await serverFile(D, "과목/3.md"), "note 3\n");
  // the folder setting follows the move: state reset, files adopted, nothing uploaded or deleted
  const n0 = Number(helper(["count", uid]));
  await D.engine.resetState("보관/UniNotes");
  assert.equal(await D.sync(), 0);
  assert.equal(Object.keys(D.data.shas).length, 12);
  assert.equal(Number(helper(["count", uid])), n0);
  assert.equal(deleted.length, 0);
  assert.ok(![...D.app.vault.files.keys()].some((p) => p.includes("사본")));
  step("moved folder: sync paused, nothing deleted; new folder setting adopts the files");

  for (let i = 0; i < 12; i++) D.app.vault.userDelete(`보관/UniNotes/과목/${i}.md`);
  await D.sync();
  assert.equal(deleted.length, 0);
  assert.equal(D.engine.held.length, 12);
  assert.ok(!D.engine.paused);
  await D.engine.restoreDeletes();
  assert.equal(await D.sync(), 12);
  assert.equal(D.local("과목/5.md"), "note 5\n");
  for (let i = 0; i < 12; i++) D.app.vault.userDelete(`보관/UniNotes/과목/${i}.md`);
  await D.sync();
  assert.equal(D.engine.held.length, 12);
  D.engine.approveDeletes();
  await D.sync();
  assert.equal(deleted.length, 12);
  assert.equal(await serverFile(D, "과목/0.md"), null);
  assert.equal(D.engine.held.length, 0);
  step("many deletes at once are held: restored, or sent after the user's OK");
}

// audit M19: edits and deletes made with no vault events (offline start, before the role is known)
async function offlineEditsFoundByScan(step: (s: string) => void) {
  const { user_id: uid, token } = user("scan@example.com");
  const D = new Device(token);
  await D.register("A");
  helper(["write", uid, "x.md"], "x\n");
  helper(["write", uid, "y.md"], "y\n");
  await D.sync();
  D.app.vault.files.set("UniNotes/x.md", enc("x edited offline\n")); // no events
  D.app.vault.files.delete("UniNotes/y.md");
  await D.engine.scanLocal(); // what main.ts runs the first time the device is known to be primary
  await D.sync();
  assert.equal(await serverFile(D, "x.md"), "x edited offline\n");
  assert.equal(await serverFile(D, "y.md"), null);
  step("edits made before the role was known are found by the scan");
}

// audit H3: the device id and sync state are this install's own, data.json is shared by devices
async function deviceIdentityIsLocal(step: (s: string) => void) {
  const { token } = user("ident@example.com");
  const dir = ".obsidian/plugins/uninotes";
  const apiFor = (id: () => string) => new Api(() => ({ serverUrl: URL_, token, deviceId: id() }));
  const plain = apiFor(() => "");
  const reg = async (a: Api, name: string) => (await a.registerDevice({ name, kind: "obsidian-desktop", client_version: "0.2.1" })).id;
  const legacyId = await reg(plain, "old shared id"); // first device: primary
  // plugin 0.2.0's data.json, copied by iCloud to two devices
  const saved = {
    serverUrl: URL_, token, folder: "UniNotes", pollSeconds: 30, deviceId: legacyId, deviceName: "Mac",
    cursor: 7, shas: { "a.md": "f".repeat(64) }, pending: {}, dirty: ["a.md"], deletes: {},
  };
  const appA = new App();
  const A = new LocalStore(appA as any, dir);
  const ra = await A.load(saved, "UniNotes");
  assert.equal(ra.legacy, true);
  assert.equal(ra.sync.cursor, 7);
  assert.deepEqual(ra.sync.dirty, ["a.md"]);
  assert.equal(A.id.deviceId, "");
  assert.equal(A.id.legacyDeviceId, legacyId);
  // A comes online first: its own id takes over the primary role, the shared id is revoked
  const apiA = apiFor(() => A.id.deviceId);
  A.id.deviceId = await reg(apiA, "A");
  await replaceLegacyDevice(apiA, legacyId, A.id.deviceId);
  A.saveIdentity();
  const B = new LocalStore(new App() as any, dir);
  await B.load(saved, "UniNotes");
  const apiB = apiFor(() => B.id.deviceId);
  B.id.deviceId = await reg(apiB, "B");
  await replaceLegacyDevice(apiB, legacyId, B.id.deviceId);
  const list = await plain.listDevices();
  assert.equal(list.primary_device_id, A.id.deviceId);
  assert.notEqual(A.id.deviceId, B.id.deviceId);
  assert.ok(!list.devices.some((d) => d.id === legacyId));
  assert.equal((await apiFor(() => legacyId).syncState()).device_id, null); // an old install registers again
  // A restarts: same id and sync state, read from this device only
  await A.saveSync(ra.sync);
  const A2 = new LocalStore(appA as any, dir);
  const r2 = await A2.load({ serverUrl: URL_, token, folder: "UniNotes" }, "UniNotes");
  assert.equal(r2.legacy, false);
  assert.equal(A2.id.deviceId, A.id.deviceId);
  assert.equal(r2.sync.cursor, 7);
  // another device that receives a copy of A's .obsidian folder does not use A's id or state
  const appC = new App();
  for (const [k, v] of appA.vault.adapter.files) appC.vault.adapter.files.set(k, v);
  const C = new LocalStore(appC as any, dir);
  const r3 = await C.load({ serverUrl: URL_, token, folder: "UniNotes" }, "UniNotes");
  assert.equal(C.id.deviceId, "");
  assert.equal(r3.sync.cursor, 0);
  // the folder setting changed (here, or on another device through data.json): state reset, id kept
  const r4 = await new LocalStore(appA as any, dir).load({ folder: "Notes" }, "Notes");
  assert.equal(r4.sync.cursor, 0);
  assert.equal(r4.sync.folder, "Notes");
  step("device id and sync state are device-local; plugin 0.2.0's shared id is replaced");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
