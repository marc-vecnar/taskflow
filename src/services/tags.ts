// Tag business logic. This layer owns all Prisma access and stays free of
// Express types so it can be unit-tested directly. Tags are scoped per user
// (unique on (userId, name)) and relate to tasks via an implicit many-to-many.
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import type { PaginationParams } from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";

// Columns returned to clients; userId is implicit (always the caller's).
const tagSelect = {
  id: true,
  name: true,
  createdAt: true,
} satisfies Prisma.TagSelect;

// A task plus its assigned tags — returned when a tag is assigned to a task.
const taskWithTagsSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: tagSelect },
} satisfies Prisma.TaskSelect;

export async function createTag(userId: string, name: string) {
  const existing = await prisma.tag.findFirst({ where: { userId, name } });
  if (existing) {
    throw AppError.conflict("Tag already exists");
  }

  try {
    return await prisma.tag.create({
      data: { name, userId },
      select: tagSelect,
    });
  } catch (err) {
    // Guards against a race between the check above and the insert.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw AppError.conflict("Tag already exists");
    }
    throw err;
  }
}

export async function listTags(
  userId: string,
  { limit, offset }: PaginationParams,
) {
  const where: Prisma.TagWhereInput = { userId };

  const [items, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      select: tagSelect,
      orderBy: { name: "asc" },
      skip: offset,
      take: limit,
    }),
    prisma.tag.count({ where }),
  ]);

  return { items, total };
}

// Assigns an existing tag to an existing task, both owned by the caller.
// Idempotent: connecting an already-linked tag is a no-op. Returns the task
// with its full tag list.
export async function assignTagToTask(
  userId: string,
  taskId: string,
  tagId: string,
) {
  // Verify ownership of both sides before touching the relation, so we can
  // return precise 404s rather than leaking another user's resources.
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId, isDeleted: false },
    select: { id: true },
  });
  if (!task) {
    throw AppError.notFound("Task not found");
  }

  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } });
  if (!tag) {
    throw AppError.notFound("Tag not found");
  }

  return prisma.task.update({
    where: { id: taskId },
    data: { tags: { connect: { id: tagId } } },
    select: taskWithTagsSelect,
  });
}
