# syntax=docker/dockerfile:1.7
#
# termlnk-web — single container hosting the Node tRPC server plus the
# pre-built browser SPA. Run from the repo root:
#
#   docker build -f apps/web/Dockerfile -t termlnk-web:latest .
#
# Phase-7 deployment shape lines up with cloud-sync-architecture.md §6.2.5:
# vault state in /data, single port 3000 (HTTP/WS shared), no embedded
# reverse proxy. Place nginx / caddy in front for TLS termination.

ARG NODE_VERSION=22-bookworm-slim
ARG PNPM_VERSION=10.33.3

# ---------- Stage 1: base node + pnpm ----------
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
RUN corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# ---------- Stage 2: workspace install + build ----------
FROM base AS builder
WORKDIR /workspace

# better-sqlite3 ships a node-gyp build; need a C++ toolchain to compile it
# for the runtime arch.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy the entire workspace. The .dockerignore at repo root strips heavy /
# secret directories so this layer stays cache-friendly.
COPY . .

# Workspace install. --ignore-scripts skips apps/desktop's electron prebuild
# fetcher, which has nothing to do with the web shell. We rebuild the one
# native module termlnk-web actually needs (better-sqlite3) right after.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm rebuild better-sqlite3

# Build every workspace package the web entrypoints depend on, and the SPA
# itself. Excluded:
# - @termlnk/termlnk-desktop / @termlnk/renderer / @termlnk/island —
#   Electron-only entrypoints that we don't ship in the web image.
# - @termlnk/web-app-server — its build script is a no-op (we run main.ts via
#   tsx in the runtime stage; see P7.3 note in cloud-sync-architecture.md).
RUN pnpm --filter "@termlnk/*" \
  --filter "!@termlnk/termlnk-desktop" \
  --filter "!@termlnk/renderer" \
  --filter "!@termlnk/island" \
  --filter "!@termlnk/web-app-server" \
  --filter "!@termlnk/web-app-renderer" \
  run build \
  && pnpm --filter "@termlnk/web-app-renderer" run build

# ---------- Stage 3: runtime ----------
FROM base AS runtime
WORKDIR /app

# Runtime needs nothing beyond ca-certificates — better-sqlite3 native is
# already compiled in the builder stage.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy the whole workspace verbatim so pnpm's symlinked workspace resolution
# stays valid and tsx finds main.ts at runtime. The image is fat (~600 MiB)
# but reproducible; further slimming (pnpm deploy --prod) is a follow-up that
# does not block v1 self-hosting.
COPY --from=builder /workspace /app

ENV NODE_ENV=production
ENV TERMLNK_WEB_PORT=3000
ENV TERMLNK_WEB_HOST=0.0.0.0
ENV TERMLNK_WEB_STATIC_ROOT=/app/apps/web/renderer/dist
ENV TERMLNK_WEB_CONFIG_DIR=/data
ENV TERMLNK_WEB_DB_PATH=/data/termlnk-web.db
# Phase-1 vault encryption seeds itself from this directory.
VOLUME ["/data"]

EXPOSE 3000

WORKDIR /app/apps/web/server

# tsx is a devDependency listed in apps/web/server/package.json and is
# installed because we did not pass --prod. It only ever processes main.ts
# itself; cross-package decorator resolution stays inside the pre-built
# lib/es directories (see P7.3 known-limitation note).
CMD ["pnpm", "start"]
