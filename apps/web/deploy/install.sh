#!/usr/bin/env bash
# termlnk-web one-line installer.
#
# Quick install (HTTP only, localhost):
#   curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh | bash
#
# With domain + HTTPS (Caddy auto-provisions a Let's Encrypt cert):
#   curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh \
#     | bash -s -- --tls termlnk.example.com
#
# Demo mode (no login, decorative traffic lights — for website embed):
#   curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh \
#     | bash -s -- --demo --tls demo.termlnk.com
#
# Environment overrides (all optional):
#   TERMLNK_INSTALL_DIR   target dir (default: /opt/termlnk-web, or $HOME/.termlnk-web when non-root)
#   TERMLNK_WEB_TAG       image tag to pin (default: latest)
#   TERMLNK_REPO_RAW      base URL for compose / Caddyfile / deploy.sh

set -euo pipefail

VERSION="${TERMLNK_WEB_TAG:-latest}"
REPO_RAW="${TERMLNK_REPO_RAW:-https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy}"
TLS_DOMAIN=""
DEMO_MODE=""
NONINTERACTIVE="${TERMLNK_NONINTERACTIVE:-0}"
INSTALL_DIR_OVERRIDE="${TERMLNK_INSTALL_DIR:-}"

# --- ANSI styling -------------------------------------------------------------
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

# --- CLI args -----------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --tls)
      TLS_DOMAIN="${2:-}"
      [ -n "$TLS_DOMAIN" ] || die "--tls requires a domain"
      shift 2
      ;;
    --demo)
      DEMO_MODE="true"
      shift
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --dir)
      INSTALL_DIR_OVERRIDE="$2"
      shift 2
      ;;
    --yes|-y)
      NONINTERACTIVE=1
      shift
      ;;
    -h|--help)
      sed -n '2,16p' "$0" 2>/dev/null || grep -E '^#' "$0" | head -n 20
      exit 0
      ;;
    *) die "Unknown flag: $1 (try --help)" ;;
  esac
done

# --- Platform / Docker checks -------------------------------------------------
os="$(uname -s)"
log "Platform: $os $(uname -m)"

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker found: $(docker --version)"
  else
    case "$os" in
      Linux)
        warn "Docker not found. Installing via get.docker.com (requires root or passwordless sudo)..."
        curl -fsSL https://get.docker.com | sh
        ;;
      Darwin)
        die "Docker is not installed. Install Docker Desktop: https://www.docker.com/products/docker-desktop"
        ;;
      *) die "Unsupported OS '$os'. Install Docker manually then re-run." ;;
    esac
  fi
  if ! docker compose version >/dev/null 2>&1; then
    die "Docker Compose v2 is required (docker compose ...). Upgrade Docker to 24+."
  fi
  if ! docker info >/dev/null 2>&1; then
    die "Docker daemon is not reachable. Start Docker and retry."
  fi
  log "Docker Compose: $(docker compose version --short 2>/dev/null || echo unknown)"
}

# --- Install directory --------------------------------------------------------
pick_install_dir() {
  if [ -n "$INSTALL_DIR_OVERRIDE" ]; then
    printf '%s' "$INSTALL_DIR_OVERRIDE"
    return
  fi
  if [ "$(id -u)" = "0" ]; then
    printf '/opt/termlnk-web'
  else
    printf '%s/.termlnk-web' "$HOME"
  fi
}

# --- Secret generation --------------------------------------------------------
gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '\n'
  elif [ -r /dev/urandom ]; then
    head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n'
  else
    die "Neither openssl nor /dev/urandom available."
  fi
}

# --- Download a deploy artifact -----------------------------------------------
fetch() {
  local relpath="$1" dest="$2"
  log "  -> $relpath"
  if ! curl -fSL --connect-timeout 10 --max-time 60 "$REPO_RAW/$relpath" -o "$dest"; then
    die "Failed to download $REPO_RAW/$relpath"
  fi
}

# --- Main ---------------------------------------------------------------------
ensure_docker

INSTALL_DIR="$(pick_install_dir)"
log "Install dir: $INSTALL_DIR"

# --- Update path (install dir already exists with .env) -----------------------
if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/.env" ]; then
  warn "$INSTALL_DIR/.env already exists — running an update instead of fresh install."
  cd "$INSTALL_DIR"
  fetch docker-compose.yml docker-compose.yml
  fetch Caddyfile Caddyfile
  fetch deploy.sh deploy.sh && chmod +x deploy.sh
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
  COMPOSE_FILES=(-f docker-compose.yml)
  [ -n "${TLS_DOMAIN:-${TERMLNK_WEB_DOMAIN:-}}" ] && COMPOSE_FILES+=(--profile tls)
  docker compose --env-file .env "${COMPOSE_FILES[@]}" pull
  docker compose --env-file .env "${COMPOSE_FILES[@]}" up -d
  ok "Updated. Run '$INSTALL_DIR/deploy.sh status' to inspect."
  exit 0
fi

# --- Fresh install ------------------------------------------------------------
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

log "Fetching deploy artifacts from $REPO_RAW"
fetch docker-compose.yml docker-compose.yml
fetch Caddyfile Caddyfile
fetch deploy.sh deploy.sh
chmod +x deploy.sh

# --- Master password ----------------------------------------------------------
SECRET_FILE="master_password.secret"
if [ -f "$SECRET_FILE" ]; then
  log "Using existing $SECRET_FILE"
else
  log "Generating a strong master password..."
  TMP_SECRET=$(mktemp "$INSTALL_DIR/.master_password.XXXXXX")
  trap 'rm -f "$TMP_SECRET"' EXIT
  ( umask 077; gen_secret >"$TMP_SECRET" )
  [ -s "$TMP_SECRET" ] || die "Failed to generate a non-empty secret"
  mv "$TMP_SECRET" "$SECRET_FILE"
  trap - EXIT
fi

# --- Write .env ---------------------------------------------------------------
umask 077
cat > .env <<EOF
# Generated by install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
TERMLNK_WEB_TAG=$VERSION
TERMLNK_WEB_DOMAIN=$TLS_DOMAIN
TERMLNK_WEB_DEMO=$DEMO_MODE
EOF
chmod 600 .env
ok "Wrote $INSTALL_DIR/.env"

# --- Boot ---------------------------------------------------------------------
COMPOSE_FILES=(-f docker-compose.yml)
if [ -n "$TLS_DOMAIN" ]; then
  log "Starting with automatic HTTPS for $TLS_DOMAIN ..."
  export TERMLNK_WEB_DOMAIN="$TLS_DOMAIN"
  COMPOSE_FILES+=(--profile tls)
fi

docker compose --env-file .env "${COMPOSE_FILES[@]}" pull
docker compose --env-file .env "${COMPOSE_FILES[@]}" up -d

# --- Readiness probe ----------------------------------------------------------
log "Waiting for termlnk-web to come online..."
for i in $(seq 1 60); do
  if docker compose --env-file .env exec -T termlnk-web node -e \
      "fetch('http://127.0.0.1:'+(process.env.TERMLNK_WEB_PORT||3000)+'/__termlnk-web/status').then(r=>r.json()).then(s=>process.exit(s.holderStatus==='unlocked'?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
    ok "termlnk-web is up after ${i}s."
    break
  fi
  if [ "$i" = "60" ]; then
    warn "Server did not become healthy within 60s. Inspect: $INSTALL_DIR/deploy.sh logs"
  fi
  sleep 2
done

# --- Summary ------------------------------------------------------------------
echo
ok "termlnk-web is running."

if [ -n "$TLS_DOMAIN" ]; then
  echo "  ${C_BOLD}URL${C_RST}           https://$TLS_DOMAIN"
else
  echo "  ${C_BOLD}URL${C_RST}           http://127.0.0.1:3000"
fi

if [ -n "$DEMO_MODE" ]; then
  echo "  ${C_BOLD}Mode${C_RST}          Demo (no login required)"
else
  echo "  ${C_BOLD}Password${C_RST}      $(cat "$SECRET_FILE")"
  echo
  echo "  ${C_DIM}BACK UP THIS PASSWORD. Losing it makes the vault permanently unrecoverable.${C_RST}"
fi

echo "  ${C_BOLD}Install dir${C_RST}   $INSTALL_DIR"
echo "  ${C_BOLD}Manage${C_RST}        $INSTALL_DIR/deploy.sh {status|logs|update|restart|stop|uninstall}"
echo
if [ -z "$TLS_DOMAIN" ] && [ -z "$DEMO_MODE" ]; then
  echo "  ${C_DIM}HTTP only — put a TLS-terminating reverse proxy in front for remote access.${C_RST}"
fi
echo "  ${C_DIM}Edit $INSTALL_DIR/.env then run './deploy.sh restart' to apply changes.${C_RST}"
