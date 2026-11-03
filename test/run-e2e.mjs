// Starts a throwaway local server (SQLite, temp data dir), bundles test/sync-e2e.ts with the Obsidian
// mock, runs it, stops the server. Usage: npm run test:e2e
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const server = resolve(here, "../../server");
const py = [join(server, ".venv/Scripts/python.exe"), join(server, ".venv/bin/python")].find(existsSync);
if (!py) throw new Error("server/.venv not found: cd server && python -m venv .venv && pip install -e .[dev]");

const port = await new Promise((ok) => {
  const s = createServer().listen(0, () => {
    const p = s.address().port;
    s.close(() => ok(p));
  });
});
const tmp = mkdtempSync(join(tmpdir(), "uninotes-e2e-"));
const env = {
  ...process.env,
  DATABASE_URL: `sqlite:///${join(tmp, "e2e.db").replace(/\\/g, "/")}`,
  DATA_DIR: join(tmp, "data"),
  LOG_DIR: join(tmp, "logs"),
  API_STUB_FIXTURES: "false",
  PYTHONIOENCODING: "utf-8",
  PYTHONUTF8: "1",
};

const out = join(tmp, "e2e.cjs");
await esbuild.build({
  entryPoints: [join(here, "sync-e2e.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  alias: { obsidian: join(here, "obsidian-mock.ts") },
  logLevel: "warning",
});

const srv = spawn(py, ["-m", "uvicorn", "uninotes.api.main:app", "--port", String(port)], { cwd: server, env, stdio: ["ignore", "ignore", "pipe"] });
let srvErr = "";
srv.stderr.on("data", (d) => (srvErr += d));
const url = `http://127.0.0.1:${port}`;
let up = false;
for (let i = 0; i < 100 && !up; i++) {
  await new Promise((r) => setTimeout(r, 200));
  up = await fetch(url + "/api/health").then((r) => r.ok, () => false);
}
let code = 1;
try {
  if (!up) throw new Error("server did not start:\n" + srvErr);
  code = await new Promise((done) => {
    const t = spawn(process.execPath, [out], {
      env: { ...env, E2E_URL: url, E2E_PY: py, E2E_HELPER: join(here, "agent_helper.py") },
      stdio: "inherit",
      cwd: server,
    });
    t.on("exit", (c) => done(c ?? 1));
  });
} finally {
  srv.kill();
  await new Promise((r) => setTimeout(r, 300));
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* windows may still hold the db */
  }
}
if (code !== 0) console.error(srvErr.split("\n").filter((l) => /Error|Traceback/.test(l)).slice(-20).join("\n"));
process.exit(code);
