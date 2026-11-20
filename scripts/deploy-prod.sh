#!/usr/bin/env bash
# ==============================================================================
# TazaTokri Safe Production Deployment Script (Phase 6B.7.2.2)
# Flow: Preflight -> Mandatory Backup -> Build -> Deploy -> Health Gate -> Summary
# ==============================================================================
set -Eeuo pipefail

START_EPOCH="$(date +%s)"
CURRENT_STEP="init"

log() {
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2"
}

on_error() {
  local exit_code=$?
  log "ERROR" "Deployment aborted during step '${CURRENT_STEP}' (exit code ${exit_code})."
  exit "$exit_code"
}
trap on_error ERR

# 1. Resolve project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_DIR"

ENV_FILE="${PROJECT_DIR}/.env"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
BACKUP_SCRIPT="${PROJECT_DIR}/scripts/backup-mysql.sh"
BACKUP_STATUS_FILE="${BACKUP_STATUS_FILE:-${PROJECT_DIR}/backend/data/backup-status/backup-status.json}"
INITIAL_BOOTSTRAP="${INITIAL_BOOTSTRAP:-false}"
FRESH_BOOTSTRAP="false"

# 2. Load .env without printing any values
CURRENT_STEP="env_load"
if [[ ! -f "$ENV_FILE" ]]; then
  log "ERROR" "Required environment file not found: ${ENV_FILE}"
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# 3. Validate APP_VERSION (never allow empty or 'latest')
CURRENT_STEP="version_validation"
APP_VERSION="${APP_VERSION:-0.4.0}"
if [[ -z "$APP_VERSION" || "$APP_VERSION" == "latest" ]]; then
  log "ERROR" "APP_VERSION must be a specific non-empty version tag (never 'latest')."
  exit 1
fi
if [[ ! "$APP_VERSION" =~ ^[A-Za-z0-9._-]+$ ]]; then
  log "ERROR" "APP_VERSION contains invalid characters: '${APP_VERSION}'."
  exit 1
fi
export APP_VERSION
log "INFO" "Target deployment APP_VERSION=${APP_VERSION} (images: tazatokri-backend:${APP_VERSION}, tazatokri-frontend:${APP_VERSION})"

# 4. Preflight validation
CURRENT_STEP="preflight"
log "INFO" "Running preflight checks..."
command -v docker >/dev/null 2>&1 || { log "ERROR" "Docker CLI is not installed."; exit 1; }
docker info >/dev/null 2>&1 || { log "ERROR" "Docker daemon is not accessible."; exit 1; }
docker compose version >/dev/null 2>&1 || { log "ERROR" "Docker Compose plugin is not available."; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { log "ERROR" "Missing ${COMPOSE_FILE}."; exit 1; }
[[ -f "$BACKUP_SCRIPT" ]] || { log "ERROR" "Missing ${BACKUP_SCRIPT}."; exit 1; }
[[ -s "${PROJECT_DIR}/infra/certs/fullchain.pem" && -s "${PROJECT_DIR}/infra/certs/privkey.pem" ]] || {
  log "ERROR" "Missing TLS certificates in ${PROJECT_DIR}/infra/certs/ (fullchain.pem and privkey.pem required before starting Nginx). Run scripts/tls-bootstrap.sh first."
  exit 1
}

docker compose -f "$COMPOSE_FILE" config -q
log "INFO" "Preflight passed (Docker, Compose config, .env, TLS certs, and backup script verified)."

# 5. Conservative Fresh-Bootstrap Detection & Mandatory Backup Gate
CURRENT_STEP="mandatory_backup"
BACKUP_GATE_RESULT="FAILED"
EXISTING_MYSQL_CID="$(docker compose -f "$COMPOSE_FILE" ps -aq mysql 2>/dev/null || true)"
EXISTING_MYSQL_VOLS="$(docker volume ls -q --filter "name=mysql_data" 2>/dev/null || true)"

if [[ "$INITIAL_BOOTSTRAP" == "true" ]]; then
  if [[ -n "$EXISTING_MYSQL_CID" || -n "$EXISTING_MYSQL_VOLS" ]]; then
    log "ERROR" "Existing MySQL container or mysql_data volume detected; refusing INITIAL_BOOTSTRAP=true bypass."
    exit 1
  fi
  FRESH_BOOTSTRAP="true"
  BACKUP_GATE_RESULT="DEFERRED_TO_POST_BOOTSTRAP"
  log "INFO" "Confirmed fresh bootstrap (no existing MySQL container or mysql_data volume). Baseline encrypted backup will run immediately after startup."
else
  RUNNING_MYSQL_CID="$(docker compose -f "$COMPOSE_FILE" ps -q mysql 2>/dev/null || true)"
  if [[ -z "$RUNNING_MYSQL_CID" ]]; then
    log "ERROR" "MySQL container is not running. Pre-deploy backup cannot be skipped (never infer emptiness from a stopped container)."
    exit 1
  fi
  log "INFO" "Executing mandatory pre-deploy MySQL backup via scripts/backup-mysql.sh (BACKUP_MODE=docker)..."
  BACKUP_MODE="docker" \
  COMPOSE_FILE="$COMPOSE_FILE" \
  MYSQL_SERVICE="mysql" \
  DB_NAME="${DB_NAME:-tazatokri}" \
  DB_USERNAME="${DB_USERNAME:-root}" \
  DB_PASSWORD="${DB_PASSWORD:-${DB_ROOT_PASSWORD:-}}" \
  BACKUP_ENV="production" \
  BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backend/data/backups}" \
  BACKUP_STATUS_FILE="$BACKUP_STATUS_FILE" \
  bash "$BACKUP_SCRIPT"
  BACKUP_GATE_RESULT="PASSED"
  log "INFO" "Mandatory pre-deploy backup gate passed."
fi

# 6. Versioned Build (does not prune or remove prior versions)
CURRENT_STEP="build_backend"
BACKEND_BUILD_RESULT="FAILED"
log "INFO" "Building tazatokri-backend:${APP_VERSION}..."
docker compose -f "$COMPOSE_FILE" build backend
BACKEND_BUILD_RESULT="PASSED"

CURRENT_STEP="build_frontend"
FRONTEND_BUILD_RESULT="FAILED"
log "INFO" "Building tazatokri-frontend:${APP_VERSION}..."
docker compose -f "$COMPOSE_FILE" build frontend
FRONTEND_BUILD_RESULT="PASSED"

# 7. Deploy (preserves volumes/MySQL data; never uses down or prune)
CURRENT_STEP="deploy"
DEPLOY_RESULT="FAILED"
log "INFO" "Note: Spring Boot executes Flyway migrations automatically on startup; application rollback does not reverse schema migrations."
log "INFO" "Deploying services for APP_VERSION=${APP_VERSION}..."
docker compose -f "$COMPOSE_FILE" up -d mysql backend frontend
DEPLOY_RESULT="PASSED"

# 8. Bounded Health Verification
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
  log "ERROR" "Backend readiness check failed after ${MAX_ATTEMPTS} attempts for APP_VERSION=${APP_VERSION}."
  log "ERROR" "Deployment is UNHEALTHY. Manual rollback may be required."
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
  log "ERROR" "Frontend Nginx health check failed after ${MAX_ATTEMPTS} attempts for APP_VERSION=${APP_VERSION}."
  log "ERROR" "Deployment is UNHEALTHY. Manual rollback may be required."
  exit 1
fi
log "INFO" "Frontend Nginx health verified (ok)."

# 8b. Mandatory Post-Bootstrap Baseline Backup (fresh VPS only)
if [[ "$FRESH_BOOTSTRAP" == "true" ]]; then
  CURRENT_STEP="post_bootstrap_backup"
  log "INFO" "Executing mandatory post-bootstrap baseline MySQL backup via scripts/backup-mysql.sh..."
  BACKUP_MODE="docker" \
  COMPOSE_FILE="$COMPOSE_FILE" \
  MYSQL_SERVICE="mysql" \
  DB_NAME="${DB_NAME:-tazatokri}" \
  DB_USERNAME="${DB_USERNAME:-root}" \
  DB_PASSWORD="${DB_PASSWORD:-${DB_ROOT_PASSWORD:-}}" \
  BACKUP_ENV="production" \
  BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backend/data/backups}" \
  BACKUP_STATUS_FILE="$BACKUP_STATUS_FILE" \
  bash "$BACKUP_SCRIPT"
  BACKUP_GATE_RESULT="PASSED (POST_BOOTSTRAP)"
  log "INFO" "Mandatory post-bootstrap baseline backup verified."
fi

# 9. Summary
CURRENT_STEP="summary"
ELAPSED="$(( $(date +%s) - START_EPOCH ))"
log "INFO" "================ DEPLOYMENT SUMMARY ================"
log "INFO" "APP_VERSION:         ${APP_VERSION}"
log "INFO" "Backup Gate:         ${BACKUP_GATE_RESULT}"
log "INFO" "Backend Build:       ${BACKEND_BUILD_RESULT}"
log "INFO" "Frontend Build:      ${FRONTEND_BUILD_RESULT}"
log "INFO" "Compose Deploy:      ${DEPLOY_RESULT}"
log "INFO" "Backend Readiness:   ${BACKEND_READY}"
log "INFO" "Frontend Health:     ${FRONTEND_HEALTHY}"
log "INFO" "Elapsed Time:        ${ELAPSED}s"
log "INFO" "===================================================="
