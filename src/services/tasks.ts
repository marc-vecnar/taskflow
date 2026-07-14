// Task business logic. This layer owns all Prisma access and stays free of
// Express types so it can be unit-tested directly. Every operation is scoped to
// the owning user, and soft-deleted rows are excluded from all reads.
import type { Prisma, Priority, TaskStatus } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import type { PaginationParams } from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";

// Columns returned to clients. userId is implicit (it's always the caller's),
// and isDeleted/deletedAt are internal soft-delete mechanics.
const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskSelect;

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: Date | null;
}

// A partial update: any subset of the mutable fields.
export type UpdateTaskInput = Partial<CreateTaskInput>;

// Sortable columns and direction for the list endpoint — the single source of
// truth the route derives its query schema from. Defaults reproduce the
// historical "newest first" ordering, so existing clients are unaffected.
export const TASK_SORT_FIELDS = ["createdAt", "priority"] as const;
export const SORT_ORDERS = ["asc", "desc"] as const;
export type TaskSortBy = (typeof TASK_SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_ORDERS)[number];

export interface ListTasksParams extends PaginationParams {
  sortBy?: TaskSortBy;
  order?: SortOrder;
}

// Builds the orderBy for listTasks. A trailing `id` tiebreaker keeps ordering
// stable when the primary key ties (e.g. many tasks sharing a priority),
// otherwise pagination could repeat or skip rows across pages.
function buildOrderBy(
  sortBy: TaskSortBy,
  order: SortOrder,
): Prisma.TaskOrderByWithRelationInput[] {
  return [{ [sortBy]: order }, { id: order }];
}

export async function createTask(userId: string, input: CreateTaskInput) {
  return prisma.task.create({
    data: { ...input, userId },
    select: taskSelect,
  });
}

export async function listTasks(
  userId: string,
  { limit, offset, sortBy = "createdAt", order = "desc" }: ListTasksParams,
) {
  const where: Prisma.TaskWhereInput = { userId, isDeleted: false };

  // Count and page in parallel; total powers the pagination meta.
  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: taskSelect,
      orderBy: buildOrderBy(sortBy, order),
      skip: offset,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return { items, total };
}

export async function getTask(userId: string, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, userId, isDeleted: false },
    select: taskSelect,
  });
  if (!task) {
    throw AppError.notFound("Task not found");
  }
  return task;
}

export async function updateTask(
  userId: string,
  id: string,
  input: UpdateTaskInput,
) {
  // Scope the update through updateMany so another user's task (or a
  // soft-deleted one) can never be touched; a 0 count means "not found".
  const { count } = await prisma.task.updateMany({
    where: { id, userId, isDeleted: false },
    data: input,
  });
  if (count === 0) {
    throw AppError.notFound("Task not found");
  }

  // Re-read to return the canonical serialized shape.
  return getTask(userId, id);
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  // Soft delete: flag the row instead of removing it. Scoped so a second
  // delete (already flagged) or another user's task yields "not found".
  const { count } = await prisma.task.updateMany({
    where: { id, userId, isDeleted: false },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  if (count === 0) {
    throw AppError.notFound("Task not found");
  }
}
