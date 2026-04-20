#!/bin/sh
# Termlnk agent hook launcher (auto-installed; do not edit manually).
#
# External AI agents (Claude Code, Codex, Cursor, Kimi, OpenCode, ...) invoke
# this script whenever a hook event fires. The script locates the bundled
# Node helper (`hook-helper.js`) and forwards all arguments + stdin to it.
#
# The helper is responsible for discovering the running Termlnk HTTP hook
# server (via env vars or the runtime.json discovery file) and POSTing the event.
set -eu

DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
HELPER="$DIR/hook-helper.js"

if [ ! -f "$HELPER" ]; then
  # Helper missing — return empty JSON so the agent can proceed.
  printf '{}\n'
  exit 0
fi

NODE_BIN="${TERMLNK_HOOK_NODE:-node}"
if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  printf '{}\n'
  exit 0
fi

exec "$NODE_BIN" "$HELPER" "$@"
