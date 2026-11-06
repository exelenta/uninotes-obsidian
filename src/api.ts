import { RequestUrlResponse, requestUrl } from "obsidian";
import type { components } from "./api-types";

export type S = components["schemas"];

/** HTTP error from the server (status >= 400). Network failures throw a plain Error instead. */
export class ApiError extends Error {
  constructor(public status: number, public detail: unknown, message: string) {
    super(message);
  }
  /** 501 = the server does not implement this endpoint yet (older server or other session's work). */
  get notImplemented(): boolean {
    return this.status === 501;
  }
}

export interface ApiConfig {
  serverUrl: string;
  token: string;
  deviceId: string;
}

/** The request never got an answer (offline, DNS, TLS, server unreachable). */
export class NetworkError extends Error {
  constructor(public cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

/** True for network failures only: an error of this device (e.g. a file it cannot write) is not "offline". */
export function isOffline(e: unknown): boolean {
  return e instanceof NetworkError;
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "토큰이 올바르지 않습니다 (설정 확인)";
    if (e.notImplemented) return "서버가 아직 이 기능을 지원하지 않습니다";
    return e.message;
  }
  if (isOffline(e)) return "서버에 연결할 수 없습니다";
  return e instanceof Error ? e.message : String(e);
}

export class Api {
  constructor(private cfg: () => ApiConfig) {}

  get base(): string {
    return this.cfg().serverUrl.replace(/\/+$/, "");
  }

  async request(method: string, path: string, opts: { json?: unknown; body?: ArrayBuffer } = {}): Promise<RequestUrlResponse> {
    const c = this.cfg();
    const headers: Record<string, string> = { Authorization: `Bearer ${c.token}` };
    if (c.deviceId) headers["X-UniNotes-Device"] = c.deviceId;
    let body: string | ArrayBuffer | undefined = opts.body;
    if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.json);
    } else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/octet-stream";
    }
    let res: RequestUrlResponse;
    try {
      res = await requestUrl({ url: this.base + path, method, headers, body, throw: false });
    } catch (e) {
      throw new NetworkError(e);
    }
    if (res.status >= 400) {
      let detail: unknown = undefined;
      try {
        detail = res.json?.detail;
      } catch {
        /* not json */
      }
      const msg = typeof detail === "string" ? detail : res.text.slice(0, 200);
      throw new ApiError(res.status, detail, `${res.status} ${msg}`);
    }
    return res;
  }

  async get<T>(path: string): Promise<T> {
    return (await this.request("GET", path)).json as T;
  }

  async post<T>(path: string, json?: unknown): Promise<T> {
    return (await this.request("POST", path, { json: json ?? {} })).json as T;
  }

  // ---- sync / devices (session C) ----
  registerDevice(req: S["DeviceCreate"]) {
    return this.post<S["DeviceOut"]>("/api/devices", req);
  }
  listDevices() {
    return this.get<S["DeviceList"]>("/api/devices");
  }
  setPrimary(id: string) {
    return this.post<S["DeviceList"]>(`/api/devices/${encodeURIComponent(id)}/primary`);
  }
  async revokeDevice(id: string): Promise<void> {
    await this.request("DELETE", `/api/devices/${encodeURIComponent(id)}`);
  }
  syncState() {
    return this.get<S["SyncState"]>("/api/sync/state");
  }
  ack(cursor: number) {
    return this.post<S["SyncState"]>("/api/sync/ack", { cursor });
  }
  async upload(path: string, base: string, data: ArrayBuffer): Promise<S["PushResult"]> {
    const q = `path=${encodeURIComponent(path)}&base_sha256=${encodeURIComponent(base)}`;
    return (await this.request("PUT", `/api/sync/upload?${q}`, { body: data })).json as S["PushResult"];
  }
  // v0.3 feed and files (kept for compatibility; the server still serves them)
  changes(since: number) {
    return this.get<S["ChangesOut"]>(`/api/sync/changes?since=${since}`);
  }
  async download(path: string): Promise<{ data: ArrayBuffer; sha: string | null } | null> {
    try {
      const res = await this.request("GET", `/api/sync/file?path=${encodeURIComponent(path)}`);
      return { data: res.arrayBuffer, sha: res.headers["x-content-sha256"] ?? null };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }
  async deleteFile(path: string, base: string): Promise<{ status: string }> {
    const q = `path=${encodeURIComponent(path)}&base_sha256=${encodeURIComponent(base)}`;
    return (await this.request("DELETE", `/api/sync/file?${q}`)).json as { status: string };
  }

  // ---- commands, reports, undo (session A2) ----
  createCommand(req: S["CommandCreate"]) {
    return this.post<S["CommandOut"]>("/api/commands", req);
  }
  cancelCommand(id: string) {
    return this.post<S["CommandOut"]>(`/api/commands/${encodeURIComponent(id)}/cancel`);
  }
  sessions(limit = 10) {
    return this.get<S["SessionList"]>(`/api/sessions?limit=${limit}`);
  }
  undoSession(id: string) {
    return this.post<S["UndoResult"]>(`/api/undo/session/${encodeURIComponent(id)}`);
  }
  undoBlock(key: string) {
    return this.post<S["UndoResult"]>(`/api/undo/block/${encodeURIComponent(key)}`);
  }
  // ---- v0.3 jobs (fallback while /api/sessions is not implemented) ----
  triggerJob() {
    return this.post<{ job_id: number }>("/api/jobs/trigger");
  }
  latestJob() {
    return this.get<S["JobOut"] | null>("/api/jobs/latest");
  }
  // ---- library (session A1) ----
  documents(offset: number) {
    return this.get<S["DocumentList"]>(`/api/library/documents?limit=500&offset=${offset}`);
  }
}
