// Reusable in-memory Prisma fake for service/route tests — no database needed.
//
// Usage in a test file (the async factory lets us reference this shared module
// despite vi.mock hoisting; the static import below resolves to the SAME
// instance, so assertions see what the service wrote):
//
//   vi.mock("../../src/lib/prisma.js", async () => {
//     const { prismaMock } = await import("../helpers/prisma-mock.js");
//     return { prisma: prismaMock };
//   });
//   import { db, resetDb } from "../helpers/prisma-mock.js";
//
// Vitest isolates the module graph per test file, so `db` is per-file; call
// resetDb() in beforeEach to isolate per test.
import { vi } from "vitest";

export interface MockStore {
  users: Array<Record<string, any>>;
  refreshTokens: Array<Record<string, any>>;
  tasks: Array<Record<string, any>>;
  tags: Array<Record<string, any>>;
}

export const db: MockStore = {
  users: [],
  refreshTokens: [],
  tasks: [],
  tags: [],
};

let userSeq = 0;
let tokenSeq = 0;
let taskSeq = 0;
let tagSeq = 0;

// Narrows a row against the subset of Prisma `where` fields the task service
// uses (id, userId, isDeleted equality).
function matchesTask(row: Record<string, any>, where: any = {}): boolean {
  return (
    (where.id === undefined || row.id === where.id) &&
    (where.userId === undefined || row.userId === where.userId) &&
    (where.isDeleted === undefined || row.isDeleted === where.isDeleted)
  );
}

// Priority sorts by enum DECLARATION order, not lexically ("HIGH" < "LOW" <
// "MEDIUM" would be wrong). Mirrors the Prisma enum in schema.prisma.
const PRIORITY_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

// Compares two task rows on a single orderBy field. Priority uses the rank map;
// everything else (createdAt, id, _seq) compares with < / >. Returns a negative,
// zero, or positive number for asc ordering.
function compareField(
  a: Record<string, any>,
  b: Record<string, any>,
  field: string,
): number {
  if (field === "priority") {
    return (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0);
  }
  const av = a[field];
  const bv = b[field];
  return av < bv ? -1 : av > bv ? 1 : 0;
}

// Applies a Prisma orderBy — either one { field: dir } object or an array of
// them (used as tiebreakers, in order) — to sort task rows. Honors asc/desc per
// field so priority-sort tests are deterministic.
function sortByOrderBy(
  rows: Array<Record<string, any>>,
  orderBy: any,
): Array<Record<string, any>> {
  const clauses = (Array.isArray(orderBy) ? orderBy : [orderBy]).filter(Boolean);
  return rows.sort((a, b) => {
    for (const clause of clauses) {
      const [field, dir] = Object.entries(clause)[0] as [string, string];
      const cmp = compareField(a, b, field);
      if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

// Narrows a tag row (id, userId, name equality) for the tag service.
function matchesTag(row: Record<string, any>, where: any = {}): boolean {
  return (
    (where.id === undefined || row.id === where.id) &&
    (where.userId === undefined || row.userId === where.userId) &&
    (where.name === undefined || row.name === where.name)
  );
}

// Applies a Prisma `select` projection ({ field: true }). The `tags` relation
// is resolved from the row's internal `_tagIds` list into projected tag rows.
function project(row: Record<string, any>, select?: any): Record<string, any> {
  if (!select) return { ...row };
  const out: Record<string, any> = {};
  for (const key of Object.keys(select)) {
    if (!select[key]) continue;
    if (key === "tags") {
      const tagSelect = select.tags?.select;
      out.tags = (row._tagIds ?? []).map((id: string) =>
        project(db.tags.find((t) => t.id === id)!, tagSelect),
      );
    } else {
      out[key] = row[key];
    }
  }
  return out;
}

export const prismaMock = {
  user: {
    findUnique: vi.fn(async ({ where }: { where: any }) =>
      db.users.find((u) =>
        where.id !== undefined ? u.id === where.id : u.email === where.email,
      ) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: any }) => {
      const now = new Date();
      const user = { id: `user-${++userSeq}`, createdAt: now, updatedAt: now, ...data };
      db.users.push(user);
      return user;
    }),
  },
  refreshToken: {
    create: vi.fn(async ({ data }: { data: any }) => {
      const row = { id: `rt-${++tokenSeq}`, revokedAt: null, createdAt: new Date(), ...data };
      db.refreshTokens.push(row);
      return row;
    }),
    findUnique: vi.fn(async ({ where }: { where: any }) =>
      db.refreshTokens.find((t) => t.tokenHash === where.tokenHash) ?? null,
    ),
    update: vi.fn(async ({ where, data }: { where: any; data: any }) => {
      const row = db.refreshTokens.find((t) => t.id === where.id);
      Object.assign(row as object, data);
      return row;
    }),
  },
  task: {
    create: vi.fn(async ({ data, select }: { data: any; select?: any }) => {
      const now = new Date();
      // Deterministic but uuid-shaped id so route-level uuid() validation (which
      // matches production's @default(uuid())) accepts it.
      const seq = ++taskSeq;
      const row = {
        id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
        description: null,
        status: "TODO",
        priority: "MEDIUM",
        dueDate: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        _seq: seq,
        _tagIds: [] as string[],
        ...data,
      };
      db.tasks.push(row);
      return project(row, select);
    }),
    findMany: vi.fn(
      async ({ where, select, orderBy, skip = 0, take }: { where?: any; select?: any; orderBy?: any; skip?: number; take?: number }) => {
        // Default to createdAt desc (tie-broken by insertion order desc for
        // stability) when the caller gives no orderBy, matching the old behavior.
        const rows = orderBy
          ? sortByOrderBy(db.tasks.filter((t) => matchesTask(t, where)), orderBy)
          : db.tasks
              .filter((t) => matchesTask(t, where))
              .sort((a, b) => b.createdAt - a.createdAt || b._seq - a._seq);
        const page = rows.slice(skip, take === undefined ? undefined : skip + take);
        return page.map((r) => project(r, select));
      },
    ),
    count: vi.fn(async ({ where }: { where?: any }) =>
      db.tasks.filter((t) => matchesTask(t, where)).length,
    ),
    findFirst: vi.fn(async ({ where, select }: { where?: any; select?: any }) => {
      const row = db.tasks.find((t) => matchesTask(t, where));
      return row ? project(row, select) : null;
    }),
    updateMany: vi.fn(async ({ where, data }: { where?: any; data: any }) => {
      const rows = db.tasks.filter((t) => matchesTask(t, where));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    }),
    update: vi.fn(
      async ({ where, data, select }: { where: any; data: any; select?: any }) => {
        const row = db.tasks.find((t) => t.id === where.id)!;
        // Only the tags-connect shape used by tag assignment is modeled.
        const connect = data?.tags?.connect;
        if (connect) {
          const ids = Array.isArray(connect) ? connect : [connect];
          for (const { id } of ids) {
            if (!row._tagIds.includes(id)) row._tagIds.push(id);
          }
        }
        const { tags, ...scalars } = data ?? {};
        Object.assign(row, scalars);
        return project(row, select);
      },
    ),
  },
  tag: {
    create: vi.fn(async ({ data, select }: { data: any; select?: any }) => {
      const seq = ++tagSeq;
      const row = {
        id: `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`,
        createdAt: new Date(),
        _seq: seq,
        ...data,
      };
      db.tags.push(row);
      return project(row, select);
    }),
    findFirst: vi.fn(async ({ where, select }: { where?: any; select?: any }) => {
      const row = db.tags.find((t) => matchesTag(t, where));
      return row ? project(row, select) : null;
    }),
    findMany: vi.fn(
      async ({ where, select, skip = 0, take }: { where?: any; select?: any; skip?: number; take?: number }) => {
        const rows = db.tags
          .filter((t) => matchesTag(t, where))
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const page = rows.slice(skip, take === undefined ? undefined : skip + take);
        return page.map((r) => project(r, select));
      },
    ),
    count: vi.fn(async ({ where }: { where?: any }) =>
      db.tags.filter((t) => matchesTag(t, where)).length,
    ),
  },
};

// Clears stored rows, id counters, and recorded mock calls. Call in beforeEach.
export function resetDb(): void {
  db.users.length = 0;
  db.refreshTokens.length = 0;
  db.tasks.length = 0;
  db.tags.length = 0;
  userSeq = 0;
  tokenSeq = 0;
  taskSeq = 0;
  tagSeq = 0;
  vi.mocked(prismaMock.user.findUnique).mockClear();
  vi.mocked(prismaMock.user.create).mockClear();
  vi.mocked(prismaMock.refreshToken.create).mockClear();
  vi.mocked(prismaMock.refreshToken.findUnique).mockClear();
  vi.mocked(prismaMock.refreshToken.update).mockClear();
  vi.mocked(prismaMock.task.create).mockClear();
  vi.mocked(prismaMock.task.findMany).mockClear();
  vi.mocked(prismaMock.task.count).mockClear();
  vi.mocked(prismaMock.task.findFirst).mockClear();
  vi.mocked(prismaMock.task.updateMany).mockClear();
  vi.mocked(prismaMock.task.update).mockClear();
  vi.mocked(prismaMock.tag.create).mockClear();
  vi.mocked(prismaMock.tag.findFirst).mockClear();
  vi.mocked(prismaMock.tag.findMany).mockClear();
  vi.mocked(prismaMock.tag.count).mockClear();
}
