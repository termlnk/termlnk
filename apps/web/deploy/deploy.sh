#!/usr/bin/env bash
# termlnk-web lifecycle manager.
#
# Lives alongside docker-compose.yml + .env inside the install dir.
# install.sh writes this script next to those files; from then on it is the
# single entry point for ops.

set -euo pipefail

if [ -t 1 ]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_RED=$'\033[31m'; C_GRN=$'\033[32m'
  C_YLW=$'\033[33m'; C_BLU=$'\033[34m'; C_RST=$'\033[0m'
else
  C_BOLD=''; C_DIM=''; C_RED=''; C_GRN=''; C_YLW=''; C_BLU=''; C_RST=''
fi
log()  { printf '%s[termlnk-web]%s %s\n' "$C_BLU" "$C_RST" "$*"; }
ok()   { printf '%s[termlnk-web]%s %s%s%s\n' "$C_BLU" "$C_RST" "$C_GRN" "$*" "$C_RST"; }
warn() { printf '%s[termlnk-web]%s %s%s%s\n' "$C_BLU" "$C_RST" "$C_YLW" "$*" "$C_RST" >&2; }
die()  { printf '%s[termlnk-web]%s %sERROR%s %s\n' "$C_BLU" "$C_RST" "$C_RED" "$C_RST" "$*" >&2; exit 1; }

cd "$(dirname "$0")"
[ -f docker-compose.yml ] || die "docker-compose.yml not found in $(pwd). Run install.sh first."
[ -f .env ]               || die ".env not found in $(pwd). Run install.sh first."

# Re-read config every command so editing .env Just Works.
DOMAIN="$(grep -E '^TERMLNK_WEB_DOMAIN=' .env 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r')"
DEMO="$(grep -E '^TERMLNK_WEB_DEMO=' .env 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r')"

compose() {
  local files=(-f docker-compose.yml)
  if [ -n "${DOMAIN:-}" ]; then
    files+=(--profile tls)
  fi
  docker compose --env-file .env "${files[@]}" "$@"
}

usage() {
  cat <<EOF
${C_BOLD}termlnk-web${C_RST} — manage your self-hosted instance

Usage: ./deploy.sh <command> [args]

  ${C_BOLD}start${C_RST}                Start all services (idempotent)
  ${C_BOLD}stop${C_RST}                 Stop all services (containers remain)
  ${C_BOLD}restart${C_RST}              Restart all services
  ${C_BOLD}status${C_RST}               docker compose ps
  ${C_BOLD}logs${C_RST} [service]       Tail logs (default: termlnk-web)

  ${C_BOLD}update${C_RST}               Pull latest images and restart
  ${C_BOLD}backup${C_RST}               Copy the SQLite vault to ./backups/
  ${C_BOLD}restore${C_RST} <file>       Restore vault from a backup (DESTRUCTIVE)

  ${C_BOLD}shell${C_RST}                Open a shell in the container
  ${C_BOLD}uninstall${C_RST} [--purge]  Tear down. --purge also deletes data volumes (DESTRUCTIVE)

Install dir: $(pwd)
Mode: $([ "$DEMO" = "true" ] && echo "demo" || echo "normal")
EOF
}

cmd_start()   { log "Starting..."; compose up -d; ok "Started."; }
cmd_stop()    { log "Stopping..."; compose stop; ok "Stopped."; }
cmd_restart() { log "Restarting..."; compose up -d --force-recreate; ok "Restarted."; }
cmd_status()  { compose ps; }
cmd_logs()    { compose logs -f "${1:-termlnk-web}"; }

cmd_update() {
  log "Pulling latest images..."
  compose pull
  log "Re-creating containers..."
  compose up -d
  ok "Updated. Run './deploy.sh status' to verify."
}

cmd_backup() {
  mkdir -p backups
  local ts dest
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  dest="backups/termlnk-web-${ts}.db"
  log "Copying SQLite vault -> $dest"
  compose cp termlnk-web:/data/termlnk-web.db "$dest"
  ok "Backup written: $(pwd)/$dest ($(du -h "$dest" | cut -f1))"
}

cmd_restore() {
  local file="${1:-}"
  [ -n "$file" ] || die "Usage: ./deploy.sh restore <backup.db>"
  [ -f "$file" ] || die "Backup file not found: $file"
  warn "About to OVERWRITE the vault. Press Ctrl-C within 5s to abort."
  sleep 5
  log "Stopping termlnk-web..."
  compose stop termlnk-web
  log "Restoring $file -> /data/termlnk-web.db"
  compose cp "$file" termlnk-web:/data/termlnk-web.db
  log "Restarting..."
  compose start termlnk-web
  ok "Restore complete."
}

cmd_shell() {
  compose exec termlnk-web sh
}

cmd_uninstall() {
  local purge=0
  [ "${1:-}" = "--purge" ] && purge=1
  if [ "$purge" = "1" ]; then
    warn "Removing containers AND data volumes (vault will be lost). Press Ctrl-C within 5s to abort."
    sleep 5
    compose down -v
    ok "Uninstalled (data volumes purged)."
  else
    compose down
    ok "Containers removed. Volumes preserved — run './deploy.sh start' to bring back up."
    log "To wipe data volumes too: ./deploy.sh uninstall --purge"
  fi
}

case "${1:-}" in
  start)     shift; cmd_start "$@" ;;
  stop)      shift; cmd_stop "$@" ;;
  restart)   shift; cmd_restart "$@" ;;
  status)    shift; cmd_status "$@" ;;
  logs)      shift; cmd_logs "$@" ;;
  update)    shift; cmd_update "$@" ;;
  backup)    shift; cmd_backup "$@" ;;
  restore)   shift; cmd_restore "$@" ;;
  shell)     shift; cmd_shell "$@" ;;
  uninstall) shift; cmd_uninstall "$@" ;;
  ''|-h|--help|help) usage ;;
  *) usage; die "Unknown command: $1" ;;
esac
