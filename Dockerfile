# syntax=docker/dockerfile:1

# ---- Builder: install all deps, generate the Prisma client, compile TS ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install deps first for better layer caching. npm ci needs the lockfile.
COPY package.json package-lock.json ./
RUN npm ci

# Generate the Prisma client against the schema. Run inside the image so the
# query-engine binary targets Linux (the runtime), not the host OS.
COPY prisma ./prisma
RUN npx prisma generate

# Compile src/ -> dist/ via tsconfig.build.json (excludes tests).
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- Runner: production-only deps + compiled output ----
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Prisma's query engine needs OpenSSL at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Production dependencies only. `prisma` is a runtime dependency here so the
# container can run `prisma migrate deploy` on start.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Regenerate the client for the pruned prod node_modules.
COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Drop root for the running process.
USER node

# Documentation only; Railway routes to whatever $PORT the app binds.
EXPOSE 3000

# Apply pending migrations, then start. If migration fails the container exits
# non-zero and Railway will not route traffic to a half-migrated deploy.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
