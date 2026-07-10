// Reusable HTTP harness: binds the Express app to an ephemeral port and exposes
// a small typed client built on the global fetch. No supertest dependency.
//
//   const { createApp } = await import("../../src/app.js"); // after vi.mock
//   const api = await startServer(createApp());
//   afterAll(() => api.close());
//   const res = await api.post("/auth/login", { email, password });
//   // authenticated request: api.get("/tasks", { token })
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

export interface ApiResponse {
  status: number;
  body: any;
}

export interface RequestOptions {
  /** Bearer token for the Authorization header. */
  token?: string;
}

export interface TestApi {
  baseUrl: string;
  get(path: string, opts?: RequestOptions): Promise<ApiResponse>;
  post(path: string, body?: unknown, opts?: RequestOptions): Promise<ApiResponse>;
  patch(path: string, body?: unknown, opts?: RequestOptions): Promise<ApiResponse>;
  del(path: string, opts?: RequestOptions): Promise<ApiResponse>;
  close(): Promise<void>;
}

async function request(
  baseUrl: string,
  method: string,
  path: string,
  body: unknown,
  opts: RequestOptions,
): Promise<ApiResponse> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Tolerate empty bodies (e.g. a 204) without throwing on JSON.parse.
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

export async function startServer(app: Express): Promise<TestApi> {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    baseUrl,
    get: (path, opts = {}) => request(baseUrl, "GET", path, undefined, opts),
    post: (path, body, opts = {}) => request(baseUrl, "POST", path, body, opts),
    patch: (path, body, opts = {}) => request(baseUrl, "PATCH", path, body, opts),
    del: (path, opts = {}) => request(baseUrl, "DELETE", path, undefined, opts),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
