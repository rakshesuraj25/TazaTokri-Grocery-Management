#!/usr/bin/env bash
# ==============================================================================
# TazaTokri Safe TLS Certificate Renewal Script (Webroot HTTP-01 + Zero-Downtime Reload)
# Preserves existing certificates if renewal fails; reloads Nginx only after nginx -t.
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_DIR"

DOMAIN="${DOMAIN:-}"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
CERTS_DIR="${PROJECT_DIR}/infra/certs"
WEBROOT_DIR="${PROJECT_DIR}/infra/certbot/www"

log() {
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2"
}

if [[ -z "$DOMAIN" ]]; then
  log "ERROR" "DOMAIN is required (e.g., DOMAIN=tazatokri.com bash scripts/tls-renew.sh)."
  exit 1
fi

command -v certbot >/dev/null 2>&1 || { log "ERROR" "certbot is not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { log "ERROR" "docker is not installed."; exit 1; }
[[ -d "$WEBROOT_DIR" ]] || { log "ERROR" "Missing ACME webroot directory: ${WEBROOT_DIR}"; exit 1; }

log "INFO" "Running certbot webroot renewal for '${DOMAIN}'..."
if ! certbot renew --webroot -w "$WEBROOT_DIR" --cert-name "$DOMAIN" --non-interactive; then
  log "ERROR" "Certbot renewal failed. Existing certificates in ${CERTS_DIR}/ were preserved."
  exit 1
fi

LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
SRC_FULL="${LIVE_DIR}/fullchain.pem"
SRC_KEY="${LIVE_DIR}/privkey.pem"

if [[ ! -s "$SRC_FULL" || ! -s "$SRC_KEY" ]]; then
  log "ERROR" "Certificate files missing or empty under ${LIVE_DIR}. Existing certificates preserved."
  exit 1
fi

TMP_FULL="${CERTS_DIR}/.fullchain.pem.tmp"
TMP_KEY="${CERTS_DIR}/.privkey.pem.tmp"
trap 'rm -f "$TMP_FULL" "$TMP_KEY"' EXIT

cp -L "$SRC_FULL" "$TMP_FULL"
cp -L "$SRC_KEY" "$TMP_KEY"
chmod 644 "$TMP_FULL"
chmod 600 "$TMP_KEY"

mv -f "$TMP_FULL" "${CERTS_DIR}/fullchain.pem"
mv -f "$TMP_KEY" "${CERTS_DIR}/privkey.pem"
log "INFO" "Updated certificates installed into ${CERTS_DIR}/."

if [[ -n "$(docker compose -f "$COMPOSE_FILE" ps -q frontend 2>/dev/null || true)" ]]; then
  log "INFO" "Validating Nginx configuration before reload..."
  docker compose -f "$COMPOSE_FILE" exec -T frontend nginx -t
  docker compose -f "$COMPOSE_FILE" exec -T frontend nginx -s reload
  log "INFO" "Nginx configuration validated and reloaded cleanly."
else
  log "WARN" "Frontend container is not running; skipping Nginx reload."
fi
