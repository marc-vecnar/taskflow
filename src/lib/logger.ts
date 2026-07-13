// Shared pino logger. Emits structured JSON to stdout in production; in
// development it routes through pino-pretty for human-readable, colorized
// output. Silenced under test so the suite output stays clean.
import { createRequire } from "node:module";
import pino from "pino";
import { config } from "./config.js";

const require = createRequire(import.meta.url);

// Pretty-print only in development, and only if pino-pretty is actually
// resolvable. It's a devDependency and absent from production images, so a
// stray NODE_ENV=development there would otherwise make pino throw at
// construction and crash the process before it can bind a port. Guarding the
// load degrades to raw JSON instead — log formatting must never take down the
// service.
function prettyTransport() {
  if (config.NODE_ENV !== "development") return undefined;
  try {
    require.resolve("pino-pretty");
  } catch {
    return undefined;
  }
  return {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "SYS:standard" },
  };
}

export const logger = pino({
  level: config.NODE_ENV === "test" ? "silent" : "info",
  transport: prettyTransport(),
});
