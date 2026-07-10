// Route-level tests for auth rate limiting. The limiter is real (in-memory);
// the global setup (tests/helpers/setup.ts) resets its windows before each
// test, so each case starts with a fresh 5-request budget per endpoint.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, type TestApi } from "../helpers/server.js";

vi.mock("../../src/lib/prisma.js", async () => {
  const { prismaMock } = await import("../helpers/prisma-mock.js");
  return { prisma: prismaMock };
});
import { resetDb } from "../helpers/prisma-mock.js";

const { createApp } = await import("../../src/app.js");

let api: TestApi;

beforeAll(async () => {
  api = await startServer(createApp());
});

afterAll(async () => {
  await api.close();
});

beforeEach(() => {
  resetDb();
});

describe("POST /auth/register rate limiting", () => {
  it("allows 5 requests per minute then returns 429", async () => {
    // Distinct emails so the first five succeed (201) rather than 409.
    for (let i = 0; i < 5; i++) {
      const { status } = await api.post("/auth/register", {
        email: `user${i}@example.com`,
        password: "password123",
      });
      expect(status).toBe(201);
    }

    const { status, body } = await api.post("/auth/register", {
      email: "user6@example.com",
      password: "password123",
    });

    expect(status).toBe(429);
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(body.error.message).toMatch(/wait a minute/i);
  });
});

describe("POST /auth/login rate limiting", () => {
  it("allows 5 requests per minute then returns 429", async () => {
    // Wrong credentials (401) still count against the limit; the 6th is blocked.
    for (let i = 0; i < 5; i++) {
      const { status } = await api.post("/auth/login", {
        email: "nobody@example.com",
        password: "password123",
      });
      expect(status).toBe(401);
    }

    const { status, body } = await api.post("/auth/login", {
      email: "nobody@example.com",
      password: "password123",
    });

    expect(status).toBe(429);
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});

describe("per-endpoint budgets", () => {
  it("register and login are limited independently", async () => {
    // Exhaust the register budget.
    for (let i = 0; i < 6; i++) {
      await api.post("/auth/register", {
        email: `x${i}@example.com`,
        password: "password123",
      });
    }

    // Login still has its own untouched budget — not rate limited.
    const { status } = await api.post("/auth/login", {
      email: "nobody@example.com",
      password: "password123",
    });
    expect(status).not.toBe(429);
  });
});
