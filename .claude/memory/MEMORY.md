# Project Memory

## Trigger
Always active.

## Project Context
- Framework: Next.js 14 (App Router)
- Database: PostgreSQL via Prisma (schema in prisma/schema.prisma)
- Auth: NextAuth v5 with custom WJWT strategy (config in lib/auth.ts)
- State management: Zustand (stores in lib/stores)
- API: tRPC with Zod validation (routers in server/routers/)
- Deployment: Vercel (config in vercel.json)
- CI: GitHub Actions (workflows in .github/workflows/)

## Key Decisions
- We chose tRPC over REST because we're a TypeScript-only team and the end-to-end safety eliminates a class of bugs.
- We chose Zustand over Redux because global state is minimal; most state lives in server components.
- Auth tokens expire after 15 minutes. Refresh tokens expire after 7 days. This is intentional for security compliance.

## Active Context
- Current sprint:
- Known Issues:
- Recent changes: 