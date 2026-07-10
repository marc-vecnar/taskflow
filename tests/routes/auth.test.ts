// Route-level tests for the auth endpoints. The real Express app is driven over
// HTTP so the full stack runs: Zod validation, asyncHandler, the auth service,
// and the error/response envelope. Prisma is mocked with the shared in-memory
// store (no database). Password hashing (bcrypt) and JWT signing run for real.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, type TestApi } from "../helpers/server.js";

// Async factory so we can bind to the shared mock module despite hoisting; the
// static import below resolves to the same instance the service receives.
vi.mock("../../src/lib/prisma.js", async () => {
  const { prismaMock } = await import("../helpers/prisma-mock.js");
  return { prisma: prismaMock };
});
import { db, resetDb } from "../helpers/prisma-mock.js";

// Imported after vi.mock (hoisted) so the service binds to the fake.
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

describe("POST /auth/register", () => {
  it("registers a new user and returns a token pair", async () => {
    const { status, body } = await api.post("/auth/register", {
      email: "new@example.com",
      password: "password123",
    });

    expect(status).toBe(201);
    expect(body.error).toBeNull();
    expect(body.data.user).toEqual({
      id: expect.any(String),
      email: "new@example.com",
    });
    // Never leak the password hash in the response.
    expect(body.data.user).not.toHaveProperty("passwordHash");
    expect(typeof body.data.accessToken).toBe("string");
    expect(typeof body.data.refreshToken).toBe("string");

    // Password is stored hashed, not in plaintext.
    expect(db.users).toHaveLength(1);
    expect(db.users[0]!.passwordHash).not.toBe("password123");

    // Refresh token is persisted hashed, not as the raw JWT.
    expect(db.refreshTokens).toHaveLength(1);
    expect(db.refreshTokens[0]!.tokenHash).not.toBe(body.data.refreshToken);
  });

  it("rejects a duplicate email with 409", async () => {
    const credentials = { email: "dup@example.com", password: "password123" };
    await api.post("/auth/register", credentials);

    const { status, body } = await api.post("/auth/register", credentials);

    expect(status).toBe(409);
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("CONFLICT");
    // The second attempt must not create another user.
    expect(db.users).toHaveLength(1);
  });
});

describe("POST /auth/login", () => {
  const credentials = { email: "user@example.com", password: "password123" };

  beforeEach(async () => {
    await api.post("/auth/register", credentials);
  });

  it("logs in with correct credentials and returns a token pair", async () => {
    const { status, body } = await api.post("/auth/login", credentials);

    expect(status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data.user.email).toBe(credentials.email);
    expect(typeof body.data.accessToken).toBe("string");
    expect(typeof body.data.refreshToken).toBe("string");
  });

  it("rejects a wrong password with 401 and a generic message", async () => {
    const { status, body } = await api.post("/auth/login", {
      email: credentials.email,
      password: "wrong-password",
    });

    expect(status).toBe(401);
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("UNAUTHORIZED");
    // Same message as unknown-email so registered emails aren't revealed.
    expect(body.error.message).toBe("Invalid email or password");
  });
});
