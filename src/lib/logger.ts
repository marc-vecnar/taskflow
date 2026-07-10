// Shared pino logger. Emits structured JSON to stdout in production; in
// development it routes through pino-pretty for human-readable, colorized
// output. Silenced under test so the suite output stays clean.
import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.NODE_ENV === "test" ? "silent" : "info",
  // Pretty-print only in development; production stays raw JSON for ingestion.
  transport:
    config.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        }
      : undefined,
});
