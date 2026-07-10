// Task routes: full CRUD scoped to the authenticated user. requireAuth guards
// the whole router; routes validate input and shape the response envelope while
// all logic lives in the task service.
import { Router } from "express";
import { TaskStatus } from "@prisma/client";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ok, paginated } from "../lib/http.js";
import { paginationSchema } from "../lib/pagination.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as tagService from "../services/tags.js";
import * as taskService from "../services/tasks.js";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(2000).nullish(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.coerce.date().nullish(),
});

// Every field optional for a PATCH, but at least one must be present so an
// empty body isn't a silent no-op.
const updateTaskSchema = createTaskSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" },
);

const idParamSchema = z.object({ id: z.string().uuid() });

const assignTagSchema = z.object({ tagId: z.string().uuid() });

export const tasksRouter: Router = Router();

tasksRouter.use(requireAuth);

tasksRouter.post(
  "/",
  validate(createTaskSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof createTaskSchema>;
    const task = await taskService.createTask(req.user!.id, input);
    res.status(201).json(ok(task));
  }),
);

tasksRouter.get(
  "/",
  validate(paginationSchema, "query"),
  asyncHandler(async (req, res) => {
    const { limit, offset } = req.query as unknown as z.infer<
      typeof paginationSchema
    >;
    const { items, total } = await taskService.listTasks(req.user!.id, {
      limit,
      offset,
    });
    res.status(200).json(paginated(items, { limit, offset, total }));
  }),
);

tasksRouter.get(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const task = await taskService.getTask(req.user!.id, id);
    res.status(200).json(ok(task));
  }),
);

tasksRouter.patch(
  "/:id",
  validate(idParamSchema, "params"),
  validate(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const input = req.body as z.infer<typeof updateTaskSchema>;
    const task = await taskService.updateTask(req.user!.id, id, input);
    res.status(200).json(ok(task));
  }),
);

tasksRouter.delete(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    await taskService.deleteTask(req.user!.id, id);
    res.status(204).send();
  }),
);

// Assign an existing tag to a task; returns the task with its full tag list.
tasksRouter.post(
  "/:id/tags",
  validate(idParamSchema, "params"),
  validate(assignTagSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const { tagId } = req.body as z.infer<typeof assignTagSchema>;
    const task = await tagService.assignTagToTask(req.user!.id, id, tagId);
    res.status(200).json(ok(task));
  }),
);
