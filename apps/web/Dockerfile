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
    pnpm install --frozen-lockfile --ignore-scripts

RUN cd /workspace/node_modules/better-sqlite3 && (npx --no-install prebuild-install -r node || npx node-gyp rebuild) \
 && cd /workspace/node_modules/node-pty && npx node-gyp rebuild \
 && cd /workspace && node -e "new (require('better-sqlite3'))(':memory:').close(); require('node-pty'); console.log('[docker] native modules ok')"

RUN pnpm --filter @termlnk/web-app-server exec vite build \
 && pnpm --filter @termlnk/web-app-renderer run build

RUN pnpm --filter @termlnk/web-app-server deploy --prod --legacy --config.allowNonAppliedPatches=true /prod \
 && cp -r node_modules/better-sqlite3/build /prod/node_modules/better-sqlite3/build \
 && cp -r node_modules/node-pty/build /prod/node_modules/node-pty/build \
 && cd /prod && node -e "new (require('better-sqlite3'))(':memory:').close(); require('node-pty'); console.log('[docker] prod closure native ok')"

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r termlnk && useradd -r -g termlnk -m termlnk

COPY --from=builder --chown=termlnk:termlnk /prod/node_modules /app/node_modules
COPY --from=builder --chown=termlnk:termlnk /workspace/apps/web/server/dist /app/dist
COPY --from=builder --chown=termlnk:termlnk /workspace/apps/web/renderer/dist /app/renderer-dist
COPY --from=builder --chown=termlnk:termlnk /workspace/packages/database/src/migrations /app/resources/migrations
COPY --from=builder --chown=termlnk:termlnk /workspace/packages/agent-core/src/bundled-skills /app/resources/bundled-skills
COPY --from=builder --chown=termlnk:termlnk /workspace/packages/agent-hook-cli/src /app/resources/agent-hook-cli

ENV NODE_ENV=production \
    TERMLNK_WEB_PORT=3000 \
    TERMLNK_WEB_HOST=0.0.0.0 \
    TERMLNK_WEB_STATIC_ROOT=/app/renderer-dist \
    TERMLNK_WEB_MIGRATIONS_DIR=/app/resources/migrations \
    TERMLNK_WEB_BUNDLED_SKILLS_DIR=/app/resources/bundled-skills \
    TERMLNK_WEB_HOOK_CLI_DIR=/app/resources/agent-hook-cli \
    TERMLNK_WEB_CONFIG_DIR=/data \
    TERMLNK_WEB_DB_PATH=/data/termlnk-web.db \
    TERMLNK_WEB_USER_SKILLS_DIR=/data/skills

RUN mkdir -p /data && chown termlnk:termlnk /data
VOLUME ["/data"]
EXPOSE 3000
USER termlnk

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.TERMLNK_WEB_PORT||3000)+'/__termlnk-web/status').then(r=>r.json()).then(s=>process.exit(s.holderStatus==='unlocked'?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/app/dist/main.mjs"]
