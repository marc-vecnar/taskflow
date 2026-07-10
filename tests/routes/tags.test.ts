// Route-level tests for the tag endpoints and tag assignment. The real Express
// app is driven over HTTP so the full stack runs: requireAuth, Zod validation,
// asyncHandler, the tag/task services, and the error/response envelope. Prisma
// is mocked with the shared in-memory store; JWT signing runs for real.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, type TestApi } from "../helpers/server.js";

vi.mock("../../src/lib/prisma.js", async () => {
  const { prismaMock } = await import("../helpers/prisma-mock.js");
  return { prisma: prismaMock };
});
import { db, resetDb } from "../helpers/prisma-mock.js";

const { createApp } = await import("../../src/app.js");

let api: TestApi;
let token: string;

beforeAll(async () => {
  api = await startServer(createApp());
});

afterAll(async () => {
  await api.close();
});

beforeEach(async () => {
  resetDb();
  const { body } = await api.post("/auth/register", {
    email: "owner@example.com",
    password: "password123",
  });
  token = body.data.accessToken;
});

const auth = () => ({ token });

describe("auth guard", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const { status } = await api.post("/tags", { name: "work" });
    expect(status).toBe(401);
  });
});

describe("POST /tags", () => {
  it("creates a tag and returns 201", async () => {
    const { status, body } = await api.post("/tags", { name: "work" }, auth());

    expect(status).toBe(201);
    expect(body.data).toMatchObject({ id: expect.any(String), name: "work" });
    expect(body.data).not.toHaveProperty("userId");
    expect(db.tags).toHaveLength(1);
  });

  it("rejects a duplicate name (per user) with 409", async () => {
    await api.post("/tags", { name: "work" }, auth());
    const { status, body } = await api.post("/tags", { name: "work" }, auth());

    expect(status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(db.tags).toHaveLength(1);
  });

  it("rejects an empty name with 400", async () => {
    const { status } = await api.post("/tags", { name: "" }, auth());
    expect(status).toBe(400);
  });
});

describe("GET /tags", () => {
  it("lists the caller's tags with pagination meta", async () => {
    await api.post("/tags", { name: "b-tag" }, auth());
    await api.post("/tags", { name: "a-tag" }, auth());

    const { status, body } = await api.get("/tags", auth());

    expect(status).toBe(200);
    expect(body.data.map((t: any) => t.name)).toEqual(["a-tag", "b-tag"]); // asc
    expect(body.meta.pagination).toEqual({ limit: 20, offset: 0, total: 2 });
  });

  it("does not leak another user's tags", async () => {
    await api.post("/tags", { name: "mine" }, auth());
    const { body: other } = await api.post("/auth/register", {
      email: "other@example.com",
      password: "password123",
    });

    const { body } = await api.get("/tags", { token: other.data.accessToken });
    expect(body.data).toHaveLength(0);
  });
});

describe("POST /tasks/:id/tags", () => {
  // Creates a task and a tag owned by the current user; returns their ids.
  async function seedTaskAndTag() {
    const { body: task } = await api.post("/tasks", { title: "t" }, auth());
    const { body: tag } = await api.post("/tags", { name: "urgent" }, auth());
    return { taskId: task.data.id, tagId: tag.data.id };
  }

  it("assigns a tag to a task and returns the task with its tags", async () => {
    const { taskId, tagId } = await seedTaskAndTag();

    const { status, body } = await api.post(
      `/tasks/${taskId}/tags`,
      { tagId },
      auth(),
    );

    expect(status).toBe(200);
    expect(body.data.id).toBe(taskId);
    expect(body.data.tags).toEqual([
      { id: tagId, name: "urgent", createdAt: expect.any(String) },
    ]);
  });

  it("is idempotent — assigning the same tag twice yields one entry", async () => {
    const { taskId, tagId } = await seedTaskAndTag();
    await api.post(`/tasks/${taskId}/tags`, { tagId }, auth());
    const { body } = await api.post(`/tasks/${taskId}/tags`, { tagId }, auth());

    expect(body.data.tags).toHaveLength(1);
  });

  it("returns 404 for an unknown task", async () => {
    const { tagId } = await seedTaskAndTag();
    const { status } = await api.post(
      "/tasks/00000000-0000-4000-8000-999999999999/tags",
      { tagId },
      auth(),
    );
    expect(status).toBe(404);
  });

  it("returns 404 for an unknown tag", async () => {
    const { taskId } = await seedTaskAndTag();
    const { status } = await api.post(
      `/tasks/${taskId}/tags`,
      { tagId: "00000000-0000-4000-9000-999999999999" },
      auth(),
    );
    expect(status).toBe(404);
  });

  it("does not let a user assign another user's tag", async () => {
    const { taskId } = await seedTaskAndTag();
    // Second user creates their own tag.
    const { body: other } = await api.post("/auth/register", {
      email: "other@example.com",
      password: "password123",
    });
    const { body: otherTag } = await api.post(
      "/tags",
      { name: "theirs" },
      { token: other.data.accessToken },
    );

    const { status } = await api.post(
      `/tasks/${taskId}/tags`,
      { tagId: otherTag.data.id },
      auth(),
    );
    expect(status).toBe(404);
  });
});
