# syntax=docker/dockerfile:1
# The API image. Build from the repository root (it needs the workspace and lockfile):
#   docker build -f apps/server/Dockerfile -t memed-api .
# Configuration comes from environment variables at run time (see apps/server/.env.example).

FROM node:22.22-alpine AS base
# pnpm at the version pinned by the root package.json's packageManager field.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Manifests first, so the install layer is reused until dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter server --store-dir /pnpm/store
COPY apps/server/ apps/server/
RUN pnpm --filter server build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
# Production dependencies only; the compiled output comes from the build stage.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter server --store-dir /pnpm/store
COPY --from=build /repo/apps/server/dist apps/server/dist
WORKDIR /repo/apps/server
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
