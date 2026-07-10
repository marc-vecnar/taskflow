// Tests for the request logging middleware. The pino logger is mocked so we can
// assert the structured fields (method, path, statusCode, responseTimeMs) it
// receives on request completion, without inspecting stdout.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startServer, type TestApi } from "../helpers/server.js";

vi.mock("../../src/lib/logger.js", () => ({
  logger: { info: vi.fn() },
}));
// Prisma is mocked so importing the app never instantiates a real client.
vi.mock("../../src/lib/prisma.js", async () => {
  const { prismaMock } = await import("../helpers/prisma-mock.js");
  return { prisma: prismaMock };
});
import { logger } from "../../src/lib/logger.js";

const { createApp } = await import("../../src/app.js");

let api: TestApi;

beforeAll(async () => {
  api = await startServer(createApp());
});

afterAll(async () => {
  await api.close();
});

// The `finish` event fires server-side; yield a tick so it lands before we read
// the mock after the client's fetch resolves.
const flush = () => new Promise((r) => setTimeout(r, 10));

function lastLog() {
  const calls = vi.mocked(logger.info).mock.calls;
  return calls[calls.length - 1]!;
}

describe("requestLogger", () => {
  it("logs method, path, status code, and response time for a request", async () => {
    const { status } = await api.get("/health");
    expect(status).toBe(200);
    await flush();

    const [payload, msg] = lastLog();
    expect(payload).toMatchObject({
      method: "GET",
      path: "/health",
      statusCode: 200,
    });
    expect(typeof (payload as any).responseTimeMs).toBe("number");
    expect((payload as any).responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(msg).toBe("request completed");
  });

  it("logs the real status code for a failed request", async () => {
    const { status } = await api.get("/no-such-route");
    expect(status).toBe(404);
    await flush();

    const [payload] = lastLog();
    expect(payload).toMatchObject({
      method: "GET",
      path: "/no-such-route",
      statusCode: 404,
    });
  });
});
