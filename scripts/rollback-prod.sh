#!/usr/bin/env bash
# ==============================================================================
# TazaTokri Safe Application-Only Production Rollback Script (Phase 6B.7.3.2A)
# Switches backend & frontend to an existing retained APP_VERSION without rebuild.
# NEVER automatically restores or modifies the MySQL database.
# ==============================================================================
set -Eeuo pipefail

START_EPOCH="$(date +%s)"
CURRENT_STEP="init"

log() {
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2"
}

on_error() {
  local exit_code=$?
  log "ERROR" "Application rollback FAILED during stage '${CURRENT_STEP}' for APP_VERSION='${APP_VERSION:-unset}' (exit code ${exit_code})."
  log "ERROR" "Manual investigation is required. No automatic second rollback or database restore was attempted."
  exit "$exit_code"
}
trap on_error ERR

# 1. Resolve project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_DIR"

ENV_FILE="${PROJECT_DIR}/.env"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"

# 2. Validate explicitly provided APP_VERSION (never guess, never allow 'latest')
CURRENT_STEP="version_validation"
APP_VERSION="${APP_VERSION:-}"
if [[ -z "$APP_VERSION" ]]; then
  log "ERROR" "APP_VERSION must be explicitly provided (e.g., APP_VERSION=0.4.0 bash scripts/rollback-prod.sh)."
  exit 1
fi
if [[ "$APP_VERSION" == "latest" ]]; then
  log "ERROR" "APP_VERSION='latest' is prohibited. Specify an explicit retained version tag."
  exit 1
fi
if [[ ! "$APP_VERSION" =~ ^[A-Za-z0-9._-]+$ ]]; then
  log "ERROR" "APP_VERSION contains invalid characters: '${APP_VERSION}'."
  exit 1
fi
export APP_VERSION
log "INFO" "Target application rollback version: APP_VERSION=${APP_VERSION}"

# Load .env silently for Compose variable resolution if present (never print values)
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# 3. Preflight validation
CURRENT_STEP="preflight"
log "INFO" "Running preflight checks..."
command -v docker >/dev/null 2>&1 || { log "ERROR" "Docker CLI is not installed."; exit 1; }
docker info >/dev/null 2>&1 || { log "ERROR" "Docker daemon is not accessible."; exit 1; }
docker compose version >/dev/null 2>&1 || { log "ERROR" "Docker Compose plugin is not available."; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { log "ERROR" "Missing ${COMPOSE_FILE}."; exit 1; }

# 4. Verify retained local Docker images exist BEFORE modifying any running service
CURRENT_STEP="image_verification"
BACKEND_IMAGE="tazatokri-backend:${APP_VERSION}"
FRONTEND_IMAGE="tazatokri-frontend:${APP_VERSION}"

if ! docker image inspect "$BACKEND_IMAGE" >/dev/null 2>&1; then
  log "ERROR" "Retained backend image not found locally: ${BACKEND_IMAGE}. Aborting without changes."
  exit 1
fi
if ! docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1; then
  log "ERROR" "Retained frontend image not found locally: ${FRONTEND_IMAGE}. Aborting without changes."
  exit 1
fi
log "INFO" "Verified local retained images: ${BACKEND_IMAGE}, ${FRONTEND_IMAGE}"

# 5. Explicit database protection notice
log "WARN" "DATABASE NOTICE: This is an APPLICATION-ONLY rollback."
log "WARN" "Flyway migrations may have already modified the database schema; application rollback does NOT reverse database migrations."
log "WARN" "If schema rollback is needed, use the separate manual disaster-recovery database restore procedure."

# 6. Application-only rollback (no rebuild, no MySQL restart, no destructive commands)
CURRENT_STEP="rollback_deploy"
log "INFO" "Switching backend and frontend containers to APP_VERSION=${APP_VERSION} (--no-build)..."
docker compose -f "$COMPOSE_FILE" up -d --no-build backend frontend

# 7. Bounded health verification
CURRENT_STEP="health_verification"
MAX_ATTEMPTS="${HEALTH_MAX_ATTEMPTS:-24}"
SLEEP_SECONDS="${HEALTH_POLL_SECONDS:-5}"
BACKEND_READY="FAILED"
FRONTEND_HEALTHY="FAILED"

log "INFO" "Polling backend readiness (http://localhost:8080/actuator/health/readiness)..."
for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  if docker compose -f "$COMPOSE_FILE" exec -T backend wget --no-verbose --tries=1 -qO- http://localhost:8080/actuator/health/readiness 2>/dev/null | grep -q '"UP"'; then
    BACKEND_READY="PASSED"
    break
  fi
  sleep "$SLEEP_SECONDS"
done

if [[ "$BACKEND_READY" != "PASSED" ]]; then
  log "ERROR" "Backend readiness check FAILED after ${MAX_ATTEMPTS} attempts for APP_VERSION=${APP_VERSION}."
  log "ERROR" "Application is UNHEALTHY. Manual investigation required (no automatic re-rollback or DB restore)."
  exit 1
fi
log "INFO" "Backend readiness verified (UP)."

log "INFO" "Polling frontend Nginx health (http://localhost:80/nginx-health)..."
for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  if docker compose -f "$COMPOSE_FILE" exec -T frontend wget --no-verbose --tries=1 -qO- http://localhost:80/nginx-health 2>/dev/null | grep -q 'ok'; then
    FRONTEND_HEALTHY="PASSED"
    break
  fi
  sleep "$SLEEP_SECONDS"
done

if [[ "$FRONTEND_HEALTHY" != "PASSED" ]]; then
  log "ERROR" "Frontend Nginx health check FAILED after ${MAX_ATTEMPTS} attempts for APP_VERSION=${APP_VERSION}."
  log "ERROR" "Application is UNHEALTHY. Manual investigation required (no automatic re-rollback or DB restore)."
  exit 1
fi
log "INFO" "Frontend Nginx health verified (ok)."

# 8. Summary
CURRENT_STEP="summary"
ELAPSED="$(( $(date +%s) - START_EPOCH ))"
log "INFO" "================ ROLLBACK SUMMARY ================"
log "INFO" "Rolled back APP_VERSION: ${APP_VERSION}"
log "INFO" "Backend Image:           ${BACKEND_IMAGE}"
log "INFO" "Frontend Image:          ${FRONTEND_IMAGE}"
log "INFO" "Backend Readiness:       ${BACKEND_READY}"
log "INFO" "Frontend Health:         ${FRONTEND_HEALTHY}"
log "INFO" "Elapsed Time:            ${ELAPSED}s"
log "INFO" "=================================================="
