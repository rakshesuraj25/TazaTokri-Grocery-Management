#!/usr/bin/env bash
# ==============================================================================
# TazaTokri Initial TLS Certificate Bootstrap Script (Fresh VPS)
# Uses Certbot standalone mode on port 80 BEFORE starting frontend Nginx.
# Dereference-copies fullchain.pem (644) and privkey.pem (600) into ./infra/certs/.
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_DIR"

DOMAIN="${DOMAIN:-}"
EXTRA_DOMAINS="${EXTRA_DOMAINS:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
SKIP_DNS_CHECK="${SKIP_DNS_CHECK:-false}"
CERTS_DIR="${PROJECT_DIR}/infra/certs"
WEBROOT_DIR="${PROJECT_DIR}/infra/certbot/www"

log() {
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2"
}

if [[ -z "$DOMAIN" || -z "$CERTBOT_EMAIL" ]]; then
  log "ERROR" "Usage: DOMAIN=tazatokri.com CERTBOT_EMAIL=ops@tazatokri.com bash scripts/tls-bootstrap.sh"
  exit 1
fi

command -v certbot >/dev/null 2>&1 || { log "ERROR" "certbot is not installed."; exit 1; }

if [[ "$SKIP_DNS_CHECK" != "true" ]] && command -v getent >/dev/null 2>&1; then
  if ! getent ahosts "$DOMAIN" >/dev/null 2>&1; then
    log "ERROR" "DNS resolution failed for '${DOMAIN}'. Configure DNS A record before requesting TLS certificates."
    exit 1
  fi
  log "INFO" "DNS resolution verified for '${DOMAIN}'."
fi

if command -v ss >/dev/null 2>&1 && ss -ltn '( sport = :80 )' 2>/dev/null | grep -q ':80 '; then
  log "ERROR" "Port 80 is currently in use. Stop any service listening on port 80 before running standalone TLS bootstrap."
  exit 1
fi

mkdir -p "$CERTS_DIR" "$WEBROOT_DIR"
chmod 755 "$CERTS_DIR" "$WEBROOT_DIR"

CERTBOT_ARGS=(
  certonly
  --standalone
  --non-interactive
  --agree-tos
  --keep-until-expiring
  -m "$CERTBOT_EMAIL"
  -d "$DOMAIN"
)

if [[ -n "$EXTRA_DOMAINS" ]]; then
  IFS=',' read -ra DOMAINS_ARR <<< "$EXTRA_DOMAINS"
  for d in "${DOMAINS_ARR[@]}"; do
    d_trimmed="$(echo "$d" | xargs)"
    [[ -n "$d_trimmed" ]] && CERTBOT_ARGS+=(-d "$d_trimmed")
  done
fi

log "INFO" "Requesting initial Let's Encrypt certificate for '${DOMAIN}' via standalone HTTP-01..."
certbot "${CERTBOT_ARGS[@]}"

LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
SRC_FULL="${LIVE_DIR}/fullchain.pem"
SRC_KEY="${LIVE_DIR}/privkey.pem"

if [[ ! -s "$SRC_FULL" || ! -s "$SRC_KEY" ]]; then
  log "ERROR" "Expected certificate files missing or empty under ${LIVE_DIR}."
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

log "INFO" "TLS certificates installed into ${CERTS_DIR}/ (fullchain.pem=644, privkey.pem=600)."
log "INFO" "Next: run INITIAL_BOOTSTRAP=true APP_VERSION=0.4.0 bash scripts/deploy-prod.sh"
