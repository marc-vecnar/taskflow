# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TaskFlow is a task-management REST API: Express + Prisma + PostgreSQL. [SPEC.md](./SPEC.md) is the authoritative spec for resources and behavior.

## Commands

- `npm run dev` — dev server with hot reload (`tsx watch src/server.ts`)
- `npm run typecheck` — `tsc --noEmit`; run this to verify changes (there is no linter configured)
- `npm test` — run the Vitest suite once
- `npm run test:watch` — Vitest in watch mode
- Run a single test file: `npx vitest run tests/routes/auth.test.ts`
- Run tests matching a name: `npx vitest run -t "registers a new user"`
- `npm run prisma:migrate` — create/apply a dev migration after editing `prisma/schema.prisma`
- `npm run prisma:generate` — regenerate the Prisma client without migrating
- `npm run build` / `npm start` — compile to `dist/` (via `tsconfig.build.json`) and run the compiled server

Requires a running PostgreSQL and a `.env` (copy `.env.example`). `src/lib/config.ts` validates env vars at import time and throws if any are missing/invalid, so the app fails fast on misconfiguration.

**Two tsconfigs, on purpose:** `tsconfig.json` includes `tests/` and drives `typecheck` (its `rootDir: "."` would emit to `dist/src/`, so it is not used for building). `tsconfig.build.json` sets `rootDir: ./src` and excludes tests, so `npm run build` emits `dist/server.js` — which is what `npm start` runs. Build with the build config, never bare `tsc`.

## Deployment (Railway + Docker)

Containerized via a multi-stage [Dockerfile](./Dockerfile); Railway builds it (see [railway.json](./railway.json), which also wires `/health` as the deploy healthcheck).

- **Config is environment-only.** Nothing loads a `.env` file at runtime — `config.ts` reads `process.env` directly, and [.dockerignore](./.dockerignore) keeps `.env*` out of the image. In production, set variables in the Railway service (the Postgres addon supplies `DATABASE_URL`; Railway injects `PORT`, which `config.PORT` picks up). The JWT secrets must be set manually.
- **Prisma at deploy time.** `prisma` is a runtime **dependency** (not dev) so the container can run `prisma migrate deploy` on start; the client is generated *inside* the image (both stages) so the query-engine binary targets Linux. The start command is `prisma migrate deploy && node dist/server.js` — a failed migration exits non-zero and blocks the deploy rather than serving a half-migrated schema.
- Runs as the non-root `node` user.

## Architecture

Three-layer request flow, strictly separated:
**routes → services → Prisma.** Routes (`src/routes/`) validate input and shape responses. Services (`src/services/`) hold business logic and are the **only** layer that touches Prisma. Keep Express types (`Request`/`Response`) out of services so they stay unit-testable.

### The response envelope
Every endpoint returns `{ data, error, meta }` (type `ApiResponse<T>` in `src/lib/types.ts`). Never assemble this by hand:
- Success: `ok(data)` or `paginated(data, pagination)` from `src/lib/http.ts`.
- Failure: throw `AppError` (see below) — the error middleware renders it via `fail()`.

**The sole exception is `GET /health`**, which returns a bare `{ status, timestamp }` — see Application wiring.

### Error handling
Throw `AppError` from `src/lib/errors.ts` for all expected failures, using its factories: `AppError.badRequest/unauthorized/forbidden/notFound/conflict/tooManyRequests`. `errorHandler` (`src/middleware/error.ts`, mounted last) maps `AppError` → its status/code, `ZodError` → 400, and anything else → a sanitized 500. This is why services/routes never build error responses directly. `notFoundHandler` (same file, mounted just before `errorHandler`) renders unmatched routes as a 404 in the same envelope.

### Critical gotcha: synchronous vs async throws
The middleware (`requireAuth`, `validate`, `rateLimit`) work by **throwing synchronously** — Express 4 catches sync throws and forwards them to `errorHandler`. Express 4 does **not** catch rejected promises. So every `async` route handler must be wrapped in `asyncHandler` (`src/lib/asyncHandler.ts`), which forwards the rejection to `next(err)`. An unwrapped async handler that rejects escapes the envelope and hangs the request — all current handlers in `src/routes/` are wrapped, so follow that pattern for new ones.

### Auth model
JWT access + refresh tokens (`src/lib/jwt.ts`). Refresh tokens are persisted **hashed** (SHA-256) in the `RefreshToken` table, enabling rotation and revocation — verification checks the stored row for `revokedAt`/`expiresAt`, not just the JWT signature. `requireAuth` (`src/middleware/auth.ts`) guards `/tasks` and `/tags`, verifies the Bearer access token, and attaches `req.user` (the `Request.user` augmentation lives in `src/types/express.d.ts`).

### Validation
`validate(schema, segment?)` from `src/middleware/validate.ts` runs a Zod schema against `body` (default), `query`, or `params`, and **overwrites that segment with the parsed/coerced value** so handlers receive typed, coerced data (e.g. pagination uses `z.coerce.number`).

### Rate limiting
`rateLimit({ windowMs, max })` from `src/middleware/rateLimit.ts` is a dependency-free sliding-window limiter keyed on client IP, applied per-route. Currently it guards `/auth/register` and `/auth/login` (5 requests/minute per IP, independent budgets). State is **in-memory and per-process**, so a multi-instance deployment needs a shared store (e.g. Redis). Tests call `resetRateLimits()` (wired into the global `beforeEach` in `tests/helpers/setup.ts`) to clear all windows between cases.

### Logging
`logger` (`src/lib/logger.ts`) is a shared pino instance: raw JSON in production, `pino-pretty` in development, and `silent` under test. `requestLogger` (`src/middleware/requestLogger.ts`) is mounted **first** in `createApp` so its timing spans the whole chain; it logs method, path, status, and response time on the response's `finish` event.

## Application wiring
`createApp()` (`src/app.ts`) builds and returns the Express app without binding a port, so tests can import it directly; `src/server.ts` is the process entry point that calls `createApp()` and listens on `config.PORT`. Middleware order in `createApp` is load-bearing: `requestLogger` → `express.json()` → `GET /health` → routers (`/auth`, `/tasks`, `/tags`) → `notFoundHandler` → `errorHandler`.

`GET /health` is the one unauthenticated endpoint, and the **only** one exempt from the response envelope: it returns a bare `{ status: "ok", timestamp: <epoch ms> }`, because uptime monitors and load-balancer probes expect a flat body. Do not "fix" it by wrapping it in `ok()` — a test in `tests/routes/health.test.ts` asserts the bare shape.

## Conventions

- **ESM + NodeNext:** local imports must include the `.js` extension even when importing a `.ts` file (e.g. `import { ok } from "../lib/http.js"`). Omitting it breaks the build.
- **Soft delete:** tasks are never hard-deleted — set `isDeleted`/`deletedAt` and exclude them from reads. The `tasks(userId, isDeleted)` index backs these queries.
- **Tags are per-user:** unique on `(userId, name)`; the Task↔Tag relation is a Prisma *implicit* many-to-many, so the join table `_TaskTags` is auto-managed and not in the schema file.
- **Prisma migrations:** edit `prisma/schema.prisma`, then run `prisma:migrate`. Never edit files under `prisma/migrations/` by hand.
- **Prisma client** is a singleton (`src/lib/prisma.ts`), reused across hot reloads to avoid exhausting DB connections.

## Status

The API surface described in [SPEC.md](./SPEC.md) is implemented end to end:

- **Foundation:** project structure, Prisma schema (migrated), shared `lib/`, `app.ts`/`server.ts` wiring.
- **Middleware:** auth, validate, error (+ 404), request logging, rate limiting.
- **Auth:** `POST /auth/register`, `/auth/login`, `/auth/refresh` — service + routes.
- **Tasks:** CRUD (`POST`/`GET` list/`GET` by id/`PATCH`/`DELETE` soft-delete) plus `POST /tasks/:id/tags` — service + routes.
- **Tags:** `POST /tags`, `GET /tags` — service + routes.
- **Health:** `GET /health`.

Tests live in `tests/` and are route-level, driving the app through `createApp()` with Prisma mocked (`tests/helpers/prisma-mock.ts`); there are no service-layer unit tests yet, which is the most obvious coverage gap.

