// Tag routes: create and list tags, and assign a tag to a task. requireAuth
// guards the whole router; routes validate input and shape the response
// envelope while all logic lives in the tag service.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ok, paginated } from "../lib/http.js";
import { paginationSchema } from "../lib/pagination.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as tagService from "../services/tags.js";

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
});

export const tagsRouter: Router = Router();

tagsRouter.use(requireAuth);

tagsRouter.post(
  "/",
  validate(createTagSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as z.infer<typeof createTagSchema>;
    const tag = await tagService.createTag(req.user!.id, name);
    res.status(201).json(ok(tag));
  }),
);

tagsRouter.get(
  "/",
  validate(paginationSchema, "query"),
  asyncHandler(async (req, res) => {
    const { limit, offset } = req.query as unknown as z.infer<
      typeof paginationSchema
    >;
    const { items, total } = await tagService.listTags(req.user!.id, {
      limit,
      offset,
    });
    res.status(200).json(paginated(items, { limit, offset, total }));
  }),
);
