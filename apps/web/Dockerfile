# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24-bookworm-slim
ARG PNPM_VERSION=10.33.3

FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
RUN corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

FROM base AS builder
WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm rebuild better-sqlite3

RUN pnpm --filter "@termlnk/*" \
  --filter "!@termlnk/termlnk-desktop" \
  --filter "!@termlnk/renderer" \
  --filter "!@termlnk/island" \
  --filter "!@termlnk/web-app-server" \
  --filter "!@termlnk/web-app-renderer" \
  run build \
  && pnpm --filter "@termlnk/web-app-renderer" run build

FROM base AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace /app

ENV NODE_ENV=production
ENV TERMLNK_WEB_PORT=3000
ENV TERMLNK_WEB_HOST=0.0.0.0
ENV TERMLNK_WEB_STATIC_ROOT=/app/apps/web/renderer/dist
ENV TERMLNK_WEB_CONFIG_DIR=/data
ENV TERMLNK_WEB_DB_PATH=/data/termlnk-web.db
VOLUME ["/data"]

EXPOSE 3000

WORKDIR /app/apps/web/server

CMD ["pnpm", "start"]
