# TaskFlow

A task-management API built with Express, Prisma, and PostgreSQL. See [SPEC.md](./SPEC.md).

## Setup

```bash
npm install
cp .env.example .env        # then edit DATABASE_URL + JWT secrets
npm run prisma:migrate      # create the database schema
npm run dev                 # start the dev server
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the server with hot reload |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run the Vitest suite |
| `npm run prisma:migrate` | Apply migrations in development |
| `npm run prisma:studio` | Browse the database |

## Layout

```
src/
  routes/       API route handlers (one file per resource)   [not yet implemented]
  services/     Business logic; calls Prisma                  [not yet implemented]
  lib/          Shared config, types, and utilities
  middleware/   Auth, validation, error handling
  types/        Ambient TypeScript declarations
tests/          Mirrors src/ with .test.ts suffix
prisma/         schema.prisma + migrations (don't edit migrations by hand)
```

## Conventions

- Every endpoint returns `{ data, error, meta }` (see `src/lib/types.ts`).
- `/tasks` and `/tags` require a Bearer access token (`requireAuth`).
- List endpoints paginate via `limit`/`offset` (see `src/lib/pagination.ts`).
- Tasks are soft-deleted (`isDeleted` flag), never hard-deleted.
