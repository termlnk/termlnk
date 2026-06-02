#!/usr/bin/env bash
set -euo pipefail

# termlnk-web one-shot deploy: generate the master-password secret, pull the
# prebuilt image, bring the stack up, and wait for it to come online.
#
# Usage:
#   ./install.sh                              # HTTP on 127.0.0.1:3000
#   ./install.sh --tls termlnk.example.com    # caddy automatic HTTPS on :80/:443

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

SECRET_FILE="master_password.secret"
TLS_DOMAIN=""

while [ $# -gt 0 ]; do
  case "$1" in
    --tls)
      TLS_DOMAIN="${2:-}"
      [ -n "$TLS_DOMAIN" ] || { echo "error: --tls requires a domain" >&2; exit 1; }
      shift 2
      ;;
    -h | --help)
      echo "Usage: $0 [--tls <domain>]"
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

command -v docker >/dev/null 2>&1 || { echo "error: docker is not installed" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "error: the 'docker compose' plugin is not available" >&2; exit 1; }

# Strong master password on first run. Never overwrite an existing vault's
# password — rotating it makes stored credentials permanently unreadable
# (same semantics as Bitwarden).
if [ -f "$SECRET_FILE" ]; then
  echo "Using existing $SECRET_FILE"
else
  echo "Generating a strong master password into $SECRET_FILE ..."
  # Write to a temp file with umask 077 so the file is 0600 from creation
  # (closes the TOCTOU window between create and chmod). rm -f the temp on
  # any unexpected exit so a half-written secret is never left behind.
  TMP_SECRET=$(mktemp "$SCRIPT_DIR/.master_password.XXXXXX")
  trap 'rm -f "$TMP_SECRET"' EXIT
  (
    umask 077
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -base64 32 | tr -d '\n' >"$TMP_SECRET"
    else
      head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n' >"$TMP_SECRET"
    fi
  )
  [ -s "$TMP_SECRET" ] || { echo "error: failed to generate a non-empty secret" >&2; exit 1; }
  mv "$TMP_SECRET" "$SECRET_FILE"
  trap - EXIT
  echo
  echo "  ============================================================"
  echo "  BACK UP THIS PASSWORD NOW. Losing it makes the vault"
  echo "  permanently unrecoverable."
  echo "  ------------------------------------------------------------"
  echo "  $(cat "$SECRET_FILE")"
  echo "  ============================================================"
  echo
fi

if [ -n "$TLS_DOMAIN" ]; then
  echo "Starting with automatic HTTPS for $TLS_DOMAIN ..."
  export TERMLNK_WEB_DOMAIN="$TLS_DOMAIN"
  docker compose --profile tls pull
  docker compose --profile tls up -d
  ACCESS_URL="https://$TLS_DOMAIN"
else
  docker compose pull
  docker compose up -d
  ACCESS_URL="http://127.0.0.1:3000"
fi

# Readiness probe runs INSIDE the container, so it reads the same
# TERMLNK_WEB_PORT the server binds to — no need to mirror compose env on the
# host or guess a port.
echo "Waiting for termlnk-web to come online ..."
i=0
while [ "$i" -lt 60 ]; do
  if docker compose exec -T termlnk-web node -e \
      "fetch('http://127.0.0.1:'+(process.env.TERMLNK_WEB_PORT||3000)+'/__termlnk-web/status').then((r)=>r.json()).then((s)=>process.exit(s.holderStatus==='unlocked'?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
    echo "termlnk-web is up."
    echo
    echo "  Open:  $ACCESS_URL"
    echo "  Sign in with the master password above."
    if [ -z "$TLS_DOMAIN" ]; then
      echo "  (HTTP only — put a TLS-terminating reverse proxy in front for remote access.)"
    fi
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done

echo "error: termlnk-web did not become healthy in time. Check: docker compose logs termlnk-web" >&2
exit 1
