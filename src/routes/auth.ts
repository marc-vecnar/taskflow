// Auth routes: register, login, and refresh. Routes validate input and shape
// the response; all logic lives in the auth service.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ok } from "../lib/http.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import * as authService from "../services/auth.js";

// Throttle credential endpoints to blunt brute-force / abuse: 5 requests per
// minute per IP. Each endpoint gets its own independent budget.
const authRateLimit = () =>
  rateLimit({
    windowMs: 60_000,
    max: 5,
    message: "Too many requests. Please wait a minute and try again.",
  });

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const authRouter: Router = Router();

authRouter.post(
  "/register",
  authRateLimit(),
  validate(credentialsSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof credentialsSchema>;
    const result = await authService.register(email, password);
    res.status(201).json(ok(result));
  }),
);

authRouter.post(
  "/login",
  authRateLimit(),
  validate(credentialsSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof credentialsSchema>;
    const result = await authService.login(email, password);
    res.status(200).json(ok(result));
  }),
);

authRouter.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const result = await authService.refresh(refreshToken);
    res.status(200).json(ok(result));
  }),
);
