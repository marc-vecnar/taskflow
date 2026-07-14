// Route-level tests for the task CRUD endpoints. The real Express app is driven
// over HTTP so the full stack runs: requireAuth, Zod validation, asyncHandler,
// the task service, and the error/response envelope. Prisma is mocked with the
// shared in-memory store (no database); JWT signing runs for real.
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

// Registers a fresh user per test and captures their access token so requests
// are authenticated against a real, signed JWT.
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
    const { status, body } = await api.get("/tasks");
    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("POST /tasks", () => {
  it("creates a task and returns 201 with the serialized task", async () => {
    const { status, body } = await api.post(
      "/tasks",
      { title: "Write tests", description: "cover the CRUD" },
      auth(),
    );

    expect(status).toBe(201);
    expect(body.error).toBeNull();
    expect(body.data).toMatchObject({
      id: expect.any(String),
      title: "Write tests",
      description: "cover the CRUD",
      status: "TODO", // default
    });
    // Internal columns are never serialized to the client.
    expect(body.data).not.toHaveProperty("userId");
    expect(body.data).not.toHaveProperty("isDeleted");
    expect(db.tasks).toHaveLength(1);
  });

  it("rejects a missing title with 400", async () => {
    const { status, body } = await api.post("/tasks", { description: "x" }, auth());
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(db.tasks).toHaveLength(0);
  });
});

describe("priority", () => {
  it("defaults priority to MEDIUM when omitted", async () => {
    const { status, body } = await api.post("/tasks", { title: "no prio" }, auth());
    expect(status).toBe(201);
    expect(body.data.priority).toBe("MEDIUM");
  });

  it("accepts an explicit priority on create", async () => {
    const { status, body } = await api.post(
      "/tasks",
      { title: "urgent", priority: "HIGH" },
      auth(),
    );
    expect(status).toBe(201);
    expect(body.data.priority).toBe("HIGH");
  });

  it("rejects an invalid priority with 400", async () => {
    const { status, body } = await api.post(
      "/tasks",
      { title: "bad", priority: "URGENT" },
      auth(),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(db.tasks).toHaveLength(0);
  });

  it("updates priority via PATCH", async () => {
    const { body: created } = await api.post("/tasks", { title: "raise me" }, auth());
    expect(created.data.priority).toBe("MEDIUM");

    const { status, body } = await api.patch(
      `/tasks/${created.data.id}`,
      { priority: "LOW" },
      auth(),
    );
    expect(status).toBe(200);
    expect(body.data.priority).toBe("LOW");
  });
});

describe("GET /tasks sorting", () => {
  // Seed one task per priority. Returns their created ids keyed by priority.
  async function seedPriorities() {
    const ids: Record<string, string> = {};
    for (const priority of ["MEDIUM", "HIGH", "LOW"]) {
      const { body } = await api.post(
        "/tasks",
        { title: priority.toLowerCase(), priority },
        auth(),
      );
      ids[priority] = body.data.id;
    }
    return ids;
  }

  it("defaults to createdAt desc (newest first), unchanged from before", async () => {
    await api.post("/tasks", { title: "first" }, auth());
    await api.post("/tasks", { title: "second" }, auth());
    await api.post("/tasks", { title: "third" }, auth());

    const { status, body } = await api.get("/tasks", auth());
    expect(status).toBe(200);
    expect(body.data.map((t: any) => t.title)).toEqual(["third", "second", "first"]);
  });

  it("sorts by priority ascending (LOW first) when asked", async () => {
    await seedPriorities();
    const { body } = await api.get("/tasks?sortBy=priority&order=asc", auth());
    expect(body.data.map((t: any) => t.priority)).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  it("sorts by priority descending (HIGH first) when asked", async () => {
    await seedPriorities();
    const { body } = await api.get("/tasks?sortBy=priority&order=desc", auth());
    expect(body.data.map((t: any) => t.priority)).toEqual(["HIGH", "MEDIUM", "LOW"]);
  });

  it("breaks priority ties with a stable id order", async () => {
    // Three tasks at the same priority; ordering must be deterministic (id desc
    // for order=desc) so pagination never repeats or skips a row.
    const created: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { body } = await api.post(
        "/tasks",
        { title: `t${i}`, priority: "MEDIUM" },
        auth(),
      );
      created.push(body.data.id);
    }
    const { body } = await api.get("/tasks?sortBy=priority&order=desc", auth());
    expect(body.data.map((t: any) => t.id)).toEqual([...created].reverse());
  });

  it("rejects an unknown sortBy with 400", async () => {
    const { status, body } = await api.get("/tasks?sortBy=title", auth());
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("rejects an unknown order with 400", async () => {
    const { status, body } = await api.get("/tasks?order=sideways", auth());
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});

describe("GET /tasks", () => {
  it("lists only the caller's tasks with pagination meta", async () => {
    await api.post("/tasks", { title: "a" }, auth());
    await api.post("/tasks", { title: "b" }, auth());
    await api.post("/tasks", { title: "c" }, auth());

    const { status, body } = await api.get("/tasks?limit=2&offset=0", auth());

    expect(status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.meta.pagination).toEqual({ limit: 2, offset: 0, total: 3 });
  });

  it("excludes soft-deleted tasks", async () => {
    const { body: created } = await api.post("/tasks", { title: "doomed" }, auth());
    await api.del(`/tasks/${created.data.id}`, auth());

    const { body } = await api.get("/tasks", auth());
    expect(body.data).toHaveLength(0);
    expect(body.meta.pagination.total).toBe(0);
  });

  it("does not leak another user's tasks", async () => {
    await api.post("/tasks", { title: "mine" }, auth());

    // A second user with their own token.
    const { body: other } = await api.post("/auth/register", {
      email: "other@example.com",
      password: "password123",
    });
    const { body } = await api.get("/tasks", { token: other.data.accessToken });

    expect(body.data).toHaveLength(0);
  });
});

describe("GET /tasks/:id", () => {
  it("returns a single task", async () => {
    const { body: created } = await api.post("/tasks", { title: "find me" }, auth());
    const { status, body } = await api.get(`/tasks/${created.data.id}`, auth());
    expect(status).toBe(200);
    expect(body.data.title).toBe("find me");
  });

  it("returns 404 for an unknown id", async () => {
    const { status, body } = await api.get(
      "/tasks/00000000-0000-0000-0000-000000000000",
      auth(),
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /tasks/:id", () => {
  it("updates mutable fields", async () => {
    const { body: created } = await api.post("/tasks", { title: "old" }, auth());
    const { status, body } = await api.patch(
      `/tasks/${created.data.id}`,
      { title: "new", status: "DONE" },
      auth(),
    );
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ title: "new", status: "DONE" });
  });

  it("rejects an empty update body with 400", async () => {
    const { body: created } = await api.post("/tasks", { title: "x" }, auth());
    const { status } = await api.patch(`/tasks/${created.data.id}`, {}, auth());
    expect(status).toBe(400);
  });

  it("returns 404 when updating another user's task", async () => {
    const { body: created } = await api.post("/tasks", { title: "mine" }, auth());
    const { body: other } = await api.post("/auth/register", {
      email: "other@example.com",
      password: "password123",
    });
    const { status } = await api.patch(
      `/tasks/${created.data.id}`,
      { title: "hijacked" },
      { token: other.data.accessToken },
    );
    expect(status).toBe(404);
  });
});

describe("dueDate", () => {
  // A fixed instant; z.coerce.date() parses the ISO string to a Date, which
  // res.json() serializes back to the same ISO string, so it round-trips exactly.
  const DUE = "2026-08-01T00:00:00.000Z";

  it("accepts a dueDate on create and round-trips it as an ISO string", async () => {
    const { status, body } = await api.post(
      "/tasks",
      { title: "ship it", dueDate: DUE },
      auth(),
    );

    expect(status).toBe(201);
    expect(body.data.dueDate).toBe(DUE);
    // Stored as a real Date on the row (coerced by validation before the service).
    expect(db.tasks[0]!.dueDate).toBeInstanceOf(Date);
  });

  it("defaults dueDate to null when omitted", async () => {
    const { body } = await api.post("/tasks", { title: "no deadline" }, auth());
    expect(body.data).toHaveProperty("dueDate", null);
  });

  it("rejects an unparseable dueDate with 400", async () => {
    const { status, body } = await api.post(
      "/tasks",
      { title: "bad date", dueDate: "not-a-date" },
      auth(),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(db.tasks).toHaveLength(0);
  });

  it("exposes dueDate on GET by id", async () => {
    const { body: created } = await api.post(
      "/tasks",
      { title: "with due", dueDate: DUE },
      auth(),
    );
    const { body } = await api.get(`/tasks/${created.data.id}`, auth());
    expect(body.data.dueDate).toBe(DUE);
  });

  it("sets a dueDate via PATCH on a task that had none", async () => {
    const { body: created } = await api.post("/tasks", { title: "later" }, auth());
    expect(created.data.dueDate).toBeNull();

    const { status, body } = await api.patch(
      `/tasks/${created.data.id}`,
      { dueDate: DUE },
      auth(),
    );
    expect(status).toBe(200);
    expect(body.data.dueDate).toBe(DUE);
  });

  it("clears a dueDate via PATCH with null", async () => {
    const { body: created } = await api.post(
      "/tasks",
      { title: "reschedule", dueDate: DUE },
      auth(),
    );

    const { status, body } = await api.patch(
      `/tasks/${created.data.id}`,
      { dueDate: null },
      auth(),
    );
    expect(status).toBe(200);
    expect(body.data.dueDate).toBeNull();
  });
});

describe("DELETE /tasks/:id", () => {
  it("soft-deletes a task and returns 204", async () => {
    const { body: created } = await api.post("/tasks", { title: "bye" }, auth());
    const { status } = await api.del(`/tasks/${created.data.id}`, auth());

    expect(status).toBe(204);
    // Row is flagged, not removed.
    expect(db.tasks).toHaveLength(1);
    expect(db.tasks[0]!.isDeleted).toBe(true);
    expect(db.tasks[0]!.deletedAt).toBeInstanceOf(Date);
  });

  it("returns 404 on a second delete of the same task", async () => {
    const { body: created } = await api.post("/tasks", { title: "bye" }, auth());
    await api.del(`/tasks/${created.data.id}`, auth());

    const { status } = await api.del(`/tasks/${created.data.id}`, auth());
    expect(status).toBe(404);
  });
});
