// Express application wiring. Kept separate from server.ts so tests can import
// the configured app without binding a port.
import express, { type Express } from "express";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authRouter } from "./routes/auth.js";
import { tagsRouter } from "./routes/tags.js";
import { tasksRouter } from "./routes/tasks.js";

export function createApp(): Express {
  const app = express();

  // First in the chain so response-time timing spans the whole request.
  app.use(requestLogger);
  app.use(express.json());

  // Deliberate exception to the { data, error, meta } envelope: uptime monitors
  // and load-balancer probes expect a flat body. Do not wrap this in ok().
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: Date.now() });
  });

  app.use("/auth", authRouter);
  app.use("/tasks", tasksRouter);
  app.use("/tags", tagsRouter);

  // 404 + error envelope must come after all routes (errorHandler is last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
