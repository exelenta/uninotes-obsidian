(globalThis as any).window ??= globalThis;

// window.localStorage (one per process, like one Obsidian install shared by its vaults)
if (typeof (globalThis as any).localStorage === "undefined") {
  const m = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  };
}

// Minimal in-memory stand-in for the parts of the Obsidian API the sync engine uses (e2e test only).

type Listener = (...a: any[]) => void;

export class TAbstractFile {
  constructor(public vault: Vault, public path: string) {}
  get name(): string {
    return this.path.split("/").pop() ?? "";
  }
}

export class TFile extends TAbstractFile {
  get extension(): string {
    const n = this.name;
    return n.includes(".") ? n.slice(n.lastIndexOf(".") + 1) : "";
  }
  get basename(): string {
    const e = this.extension;
    return e ? this.name.slice(0, -(e.length + 1)) : this.name;
  }
  get stat() {
    return { size: this.vault.files.get(this.path)?.byteLength ?? 0, mtime: 0, ctime: 0 };
  }
}

export class TFolder extends TAbstractFile {
  get children(): TAbstractFile[] {
    const pre = this.path + "/";
    return [...this.vault.files.keys()].filter((p) => p.startsWith(pre) && !p.slice(pre.length).includes("/"))
      .map((p) => new TFile(this.vault, p));
  }
}

/** The non-vault files of a device (.obsidian/...): DataAdapter subset. */
export class Adapter {
  files = new Map<string, string>();
  async exists(p: string) {
    return this.files.has(p);
  }
  async read(p: string) {
    if (!this.files.has(p)) throw new Error("ENOENT " + p);
    return this.files.get(p)!;
  }
  async write(p: string, data: string) {
    this.files.set(p, data);
  }
}

export class Vault {
  files = new Map<string, ArrayBuffer>();
  folders = new Set<string>();
  adapter = new Adapter();
  configDir = ".obsidian";
  /** test hook: paths this "OS" refuses to write (e.g. names iOS or Windows reject) */
  reject?: (path: string) => boolean;
  private listeners: Record<string, Listener[]> = {};

  on(ev: string, fn: Listener) {
    (this.listeners[ev] ??= []).push(fn);
  }
  private emit(ev: string, ...a: any[]) {
    // Obsidian delivers vault events asynchronously
    setTimeout(() => (this.listeners[ev] ?? []).forEach((f) => f(...a)), 5);
  }
  getAbstractFileByPath(p: string): TAbstractFile | null {
    if (this.files.has(p)) return new TFile(this, p);
    if (this.folders.has(p)) return new TFolder(this, p);
    return null;
  }
  getFiles(): TFile[] {
    return [...this.files.keys()].map((p) => new TFile(this, p));
  }
  getName() {
    return "test-vault";
  }
  async readBinary(f: TFile): Promise<ArrayBuffer> {
    const d = this.files.get(f.path);
    if (!d) throw new Error("ENOENT " + f.path);
    return d.slice(0);
  }
  async modifyBinary(f: TFile, data: ArrayBuffer) {
    if (this.reject?.(f.path)) throw new Error("EINVAL: cannot write " + f.path);
    this.files.set(f.path, data.slice(0));
    this.emit("modify", f);
  }
  async createBinary(p: string, data: ArrayBuffer) {
    if (this.reject?.(p)) throw new Error("EINVAL: cannot create " + p);
    if (this.files.has(p)) throw new Error("exists " + p);
    this.files.set(p, data.slice(0));
    const f = new TFile(this, p);
    this.emit("create", f);
    return f;
  }
  async createFolder(p: string) {
    this.folders.add(p);
  }
  // test helpers: user actions
  userWrite(p: string, text: string) {
    const existed = this.files.has(p);
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) this.folders.add(parts.slice(0, i).join("/"));
    this.files.set(p, new TextEncoder().encode(text).buffer as ArrayBuffer);
    this.emit(existed ? "modify" : "create", new TFile(this, p));
  }
  userDelete(p: string) {
    this.files.delete(p);
    this.emit("delete", new TFile(this, p));
  }
  read(p: string): string | null {
    const d = this.files.get(p);
    return d ? new TextDecoder().decode(d) : null;
  }
  remove(p: string) {
    this.files.delete(p);
    this.emit("delete", new TFile(this, p));
  }
  async rename(f: TFile, to: string) {
    const d = this.files.get(f.path)!;
    this.files.delete(f.path);
    this.files.set(to, d);
    this.emit("rename", new TFile(this, to), f.path);
  }
  /** test helper: the user moves or renames a folder (events for every file and the folder, like Obsidian) */
  moveFolder(from: string, to: string) {
    const pre = from + "/";
    for (const p of [...this.files.keys()].filter((x) => x.startsWith(pre))) {
      const np = to + "/" + p.slice(pre.length);
      this.files.set(np, this.files.get(p)!);
      this.files.delete(p);
      this.emit("rename", new TFile(this, np), p);
    }
    for (const f of [...this.folders].filter((x) => x === from || x.startsWith(pre))) {
      this.folders.delete(f);
      this.folders.add(to + f.slice(from.length));
    }
    const parts = to.split("/");
    for (let i = 1; i < parts.length; i++) this.folders.add(parts.slice(0, i).join("/"));
    this.emit("rename", new TFolder(this, to), from);
  }
}

let apps = 0;

export class App {
  appId = `test-app-${++apps}`;
  vault = new Vault();
  /** fileManager.renameFile rewrites links all over the vault: the engine must not use it (audit M20) */
  renameFileCalls: string[] = [];
  fileManager = {
    trashFile: async (f: TAbstractFile) => this.vault.remove(f.path),
    renameFile: async (f: TFile, to: string) => {
      this.renameFileCalls.push(to);
      await this.vault.rename(f, to);
    },
  };
}

export class Notice {
  static log: string[] = [];
  constructor(msg: string, _timeout?: number) {
    Notice.log.push(msg);
  }
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
  text: string;
  json: any;
}

export async function requestUrl(r: { url: string; method?: string; headers?: Record<string, string>; body?: string | ArrayBuffer }): Promise<RequestUrlResponse> {
  const go = () => fetch(r.url, { method: r.method, headers: r.headers, body: r.body as any });
  let res: Response;
  try {
    res = await go();
  } catch (e: any) {
    // a kept-alive socket the server closed while the test waited on a slow helper: send again once
    if (e?.cause?.code !== "ECONNRESET") throw e;
    res = await go();
  }
  const buf = await res.arrayBuffer();
  const text = new TextDecoder().decode(buf);
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  return { status: res.status, headers, arrayBuffer: buf, text, json };
}
