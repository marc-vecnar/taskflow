// Route-level test for the health check endpoint.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startServer, type TestApi } from "../helpers/server.js";

// Prisma is mocked so importing the app never instantiates a real client.
vi.mock("../../src/lib/prisma.js", async () => {
  const { prismaMock } = await import("../helpers/prisma-mock.js");
  return { prisma: prismaMock };
});

const { createApp } = await import("../../src/app.js");

let api: TestApi;

beforeAll(async () => {
  api = await startServer(createApp());
});

afterAll(async () => {
  await api.close();
});

describe("GET /health", () => {
  it("returns 200 with status ok and a current timestamp", async () => {
    const before = Date.now();
    const { status, body } = await api.get("/health");
    const after = Date.now();

    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    // A fresh epoch-ms timestamp, generated during the request.
    expect(typeof body.timestamp).toBe("number");
    expect(body.timestamp).toBeGreaterThanOrEqual(before);
    expect(body.timestamp).toBeLessThanOrEqual(after);
  });

  // Health is the one endpoint exempt from the { data, error, meta } envelope:
  // probes expect a flat body. Guards against a well-meaning re-wrap in ok().
  it("returns a bare body, not the response envelope", async () => {
    const { body } = await api.get("/health");

    expect(Object.keys(body).sort()).toEqual(["status", "timestamp"]);
    expect(body).not.toHaveProperty("data");
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("meta");
  });
});
