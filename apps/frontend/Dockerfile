# syntax=docker/dockerfile:1
# The web image. Build from the repository root (it needs the workspace and lockfile):
#   docker build -f apps/frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:4200 -t memed-web .
# NEXT_PUBLIC_API_URL is inlined into the browser bundle at build time, so it must be an
# address the user's browser can reach (not a Docker service name), and changing it needs
# a rebuild.

FROM node:22.22-alpine AS base
# pnpm at the version pinned by the root package.json's packageManager field.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Manifests first, so the install layer is reused until dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter frontend --store-dir /pnpm/store
COPY apps/frontend/ apps/frontend/
ARG NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL" || { echo "the NEXT_PUBLIC_API_URL build argument is required" >&2; exit 1; }
RUN pnpm --filter frontend build && rm -rf apps/frontend/.next/cache

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/next.config.ts apps/frontend/
# Production dependencies only (next, react, react-dom); the build comes from the build stage.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter frontend --store-dir /pnpm/store
# next start writes rendered pages into .next at run time, so the runtime user owns it.
COPY --from=build --chown=node:node /repo/apps/frontend/.next apps/frontend/.next
WORKDIR /repo/apps/frontend
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--port", "3000"]
