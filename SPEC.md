# TaskFlow Spec

## Stack
- Express.js + Typescript
- PostgreSQL + Prisma ORM
- JWT authentication (access + refresh tokens)
- Zod input validation
- Vitest for testing

## Resources
- Users: register, login, refresh token
- Tasks: CRUD operations scoped to authenticated user
- Tags: create, list, assign to tasks (many-to-many)

## Structure
- src/routes/		// API route handlers (one file per resource)
- src/services/		// Business logic per resource (called by routes, calls Prisma)
- src/lib/			// Shared Utilies and types, and config
- src/middleware/	// Auth, error handling, validation
- tests/			// Mirror of src/ structure with .test.ts suffix
- prisma/			// Schema and migrations (do NOT edit migrations manually)

## Behavior 
- All endpoints return JSON with shape { data, error, meta } 
- Auth required on all /tasks and /tags endpoints
- Pagination on list endpoints (limit/offset query params)
- Soft delete on tasks (isDeleted flag, not actual DELETE)
