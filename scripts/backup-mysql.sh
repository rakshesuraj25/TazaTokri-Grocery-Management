#!/usr/bin/env bash
# TazaTokri Automated Fail-Safe MySQL Backup Script (Linux / Docker / Production)
# Reads credentials from env (DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD)
# using a temporary chmod-600 MySQL option file (--defaults-extra-file).
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-tazatokri}"
DB_USER="${DB_USERNAME:-root}"
BACKUP_DIR="${BACKUP_DIR:-./backend/data/backups}"
BACKUP_STATUS_FILE="${BACKUP_STATUS_FILE:-}"
BACKUP_MODE="${BACKUP_MODE:-auto}"
COMPOSE_FILE="${COMPOSE_FILE:-./docker-compose.yml}"
MYSQL_SERVICE="${MYSQL_SERVICE:-mysql}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_ENV="${BACKUP_ENV:-production}"
BACKUP_ENCRYPTION_PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:-}"
ALLOW_UNENCRYPTED_NONPROD="${ALLOW_UNENCRYPTED_NONPROD:-false}"
RETENTION_DRY_RUN="${RETENTION_DRY_RUN:-false}"
BACKUP_VERSION="6C.3.0"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" || true

START_EPOCH="$(date +%s)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ISO_TIMESTAMP="$(date -Iseconds)"
BACKUP_ID="bkp_${TIMESTAMP}_$$"
BACKUP_TYPE="FULL_LOGICAL"
if [[ "$DB_NAME" == *"test"* ]]; then
  BACKUP_TYPE="TEST_LOGICAL"
fi

RAW_SQL_FILE="tazatokri_backup_${TIMESTAMP}.sql"
GZ_FILE="${RAW_SQL_FILE}.gz"
ENC_FILE="${GZ_FILE}.enc"
LOG_PATH="${BACKUP_DIR}/backup.log"
STATUS_JSON="${BACKUP_STATUS_FILE:-${BACKUP_DIR}/backup-status.json}"
STATUS_DIR="$(dirname "$STATUS_JSON")"
mkdir -p "$STATUS_DIR"
if [[ "$STATUS_DIR" != "$BACKUP_DIR" ]]; then
  chmod 755 "$STATUS_DIR" || true
fi
LOCK_FILE="${BACKUP_DIR}/.backup.lock"

TMP_DIR="$(mktemp -d)"
CNF_FILE="${TMP_DIR}/my.cnf"
TMP_SQL="${TMP_DIR}/${RAW_SQL_FILE}"
TMP_GZ="${TMP_DIR}/${GZ_FILE}"
TMP_ENC="${TMP_DIR}/${ENC_FILE}"
FINAL_FILE="$GZ_FILE"
FINAL_TMP="$TMP_GZ"
ENCRYPTED="false"
COMPRESSED="false"
VERIFICATION_STATUS="FAILED"

log_msg() {
  local level="$1"
  local msg="$2"
  echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $msg" | tee -a "$LOG_PATH"
}

write_failed_status() {
  local reason="$1"
  local end_epoch duration
  end_epoch="$(date +%s)"
  duration="$((end_epoch - START_EPOCH))"
  cat > "${STATUS_JSON}.tmp" <<EOF
{
  "status": "FAILED",
  "backupId": "${BACKUP_ID}",
  "backupType": "${BACKUP_TYPE}",
  "databaseName": "${DB_NAME}",
  "timestamp": "${ISO_TIMESTAMP}",
  "lastBackupAt": "${ISO_TIMESTAMP}",
  "fileName": null,
  "backupFilename": null,
  "fileSizeBytes": 0,
  "sha256": null,
  "sha256Checksum": null,
  "compressed": ${COMPRESSED},
  "encrypted": ${ENCRYPTED},
  "durationSeconds": ${duration},
  "backupVersion": "${BACKUP_VERSION}",
  "verificationStatus": "FAILED",
  "failureReason": "${reason//\"/\'}"
}
EOF
  mv -f "${STATUS_JSON}.tmp" "$STATUS_JSON"
  chmod 644 "$STATUS_JSON"
}

cleanup() {
  local exit_code=$?
  rm -rf "$TMP_DIR"
  rm -f "$LOCK_FILE"
  if [[ $exit_code -ne 0 && "$VERIFICATION_STATUS" != "VERIFIED" ]]; then
    write_failed_status "Backup aborted with exit code ${exit_code}"
  fi
}
trap cleanup EXIT

if [[ -f "$LOCK_FILE" ]]; then
  log_msg "ERROR" "Another backup job appears to be running ($LOCK_FILE exists)."
  exit 1
fi
echo "$$" > "$LOCK_FILE"

if [[ -z "${DB_PASSWORD:-}" ]]; then
  log_msg "ERROR" "DB_PASSWORD environment variable is required."
  write_failed_status "Missing DB_PASSWORD"
  exit 1
fi

if [[ -z "$BACKUP_ENCRYPTION_PASSPHRASE" ]]; then
  if [[ "$BACKUP_ENV" == "production" && "$ALLOW_UNENCRYPTED_NONPROD" != "true" ]]; then
    log_msg "ERROR" "BACKUP_ENCRYPTION_PASSPHRASE is required in production mode."
    write_failed_status "Missing BACKUP_ENCRYPTION_PASSPHRASE in production"
    exit 1
  fi
fi

USE_DOCKER_EXEC="false"
if [[ "$BACKUP_MODE" == "docker" ]]; then
  USE_DOCKER_EXEC="true"
elif [[ "$BACKUP_MODE" == "auto" ]]; then
  if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" ]] && command -v docker >/dev/null 2>&1 && [[ -f "$COMPOSE_FILE" ]]; then
    if [[ -n "$(docker compose -f "$COMPOSE_FILE" ps -q "$MYSQL_SERVICE" 2>/dev/null || true)" ]]; then
      USE_DOCKER_EXEC="true"
    fi
  fi
elif [[ "$BACKUP_MODE" != "host" ]]; then
  log_msg "ERROR" "Invalid BACKUP_MODE='${BACKUP_MODE}' (expected auto, docker, or host)."
  write_failed_status "Invalid BACKUP_MODE"
  exit 1
fi

if [[ "$USE_DOCKER_EXEC" == "true" ]]; then
  command -v docker >/dev/null 2>&1 || { log_msg "ERROR" "Docker CLI not found for docker backup mode."; write_failed_status "Missing docker CLI"; exit 1; }
  [[ -f "$COMPOSE_FILE" ]] || { log_msg "ERROR" "Compose file not found: $COMPOSE_FILE"; write_failed_status "Missing compose file"; exit 1; }
  MYSQL_CID="$(docker compose -f "$COMPOSE_FILE" ps -q "$MYSQL_SERVICE" 2>/dev/null || true)"
  if [[ -z "$MYSQL_CID" ]]; then
    log_msg "ERROR" "MySQL container (${MYSQL_SERVICE}) is not running."
    write_failed_status "MySQL container not running"
    exit 1
  fi
  log_msg "INFO" "Starting MySQL 8.4 backup (${BACKUP_ID}) via docker compose exec (${MYSQL_SERVICE}) for database '${DB_NAME}'"
  if ! docker compose -f "$COMPOSE_FILE" exec -T -e MYSQL_PWD="$DB_PASSWORD" "$MYSQL_SERVICE" mysqldump \
    -h 127.0.0.1 \
    -P 3306 \
    -u "$DB_USER" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --hex-blob \
    --set-gtid-purged=OFF \
    --default-character-set=utf8mb4 \
    "$DB_NAME" > "$TMP_SQL"; then
    log_msg "ERROR" "docker compose exec mysqldump failed for database '${DB_NAME}'."
    write_failed_status "mysqldump execution failed"
    exit 1
  fi
else
  # Protected temporary MySQL option file (never pass password on CLI)
  umask 077
  cat > "$CNF_FILE" <<EOF
[client]
host=${DB_HOST}
port=${DB_PORT}
user=${DB_USER}
password=${DB_PASSWORD}
EOF
  chmod 600 "$CNF_FILE"

  log_msg "INFO" "Starting MySQL 8.4 backup (${BACKUP_ID}) for database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}"

  if ! mysqldump \
    --defaults-extra-file="$CNF_FILE" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --hex-blob \
    --set-gtid-purged=OFF \
    --default-character-set=utf8mb4 \
    --result-file="$TMP_SQL" \
    "$DB_NAME"; then
    log_msg "ERROR" "mysqldump failed for database '${DB_NAME}'."
    write_failed_status "mysqldump execution failed"
    exit 1
  fi
fi

if [[ ! -s "$TMP_SQL" ]]; then
  log_msg "ERROR" "mysqldump produced an empty file."
  write_failed_status "Empty mysqldump output"
  exit 1
fi

# Compress (.sql.gz)
if ! gzip -f -9 "$TMP_SQL" || [[ ! -s "$TMP_GZ" ]] || ! gzip -t "$TMP_GZ"; then
  log_msg "ERROR" "Gzip compression or integrity check failed."
  write_failed_status "Compression failed"
  exit 1
fi
COMPRESSED="true"

# Encrypt (.sql.gz.enc) via OpenSSL AES-256-CBC PBKDF2
if [[ -n "$BACKUP_ENCRYPTION_PASSPHRASE" ]]; then
  export BACKUP_ENCRYPTION_PASSPHRASE
  if ! openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
    -in "$TMP_GZ" \
    -out "$TMP_ENC" \
    -pass env:BACKUP_ENCRYPTION_PASSPHRASE || [[ ! -s "$TMP_ENC" ]]; then
    log_msg "ERROR" "OpenSSL encryption failed."
    write_failed_status "Encryption failed"
    exit 1
  fi
  rm -f "$TMP_GZ"
  FINAL_FILE="$ENC_FILE"
  FINAL_TMP="$TMP_ENC"
  ENCRYPTED="true"
fi

# Compute & verify SHA-256 before promoting to official backup directory
SHA256="$(sha256sum "$FINAL_TMP" | awk '{print $1}')"
echo "${SHA256}  ${FINAL_FILE}" > "${FINAL_TMP}.sha256"
if ! (cd "$TMP_DIR" && sha256sum -c "${FINAL_FILE}.sha256" >/dev/null 2>&1); then
  log_msg "ERROR" "SHA-256 verification failed on temporary artifact."
  write_failed_status "SHA-256 verification failed"
  exit 1
fi

DEST_PATH="${BACKUP_DIR}/${FINAL_FILE}"
DEST_SHA="${DEST_PATH}.sha256"
mv "$FINAL_TMP" "$DEST_PATH"
mv "${FINAL_TMP}.sha256" "$DEST_SHA"
chmod 600 "$DEST_PATH" "$DEST_SHA"

FILE_SIZE="$(wc -c < "$DEST_PATH" | tr -d ' ')"
VERIFICATION_STATUS="VERIFIED"
END_EPOCH="$(date +%s)"
DURATION="$((END_EPOCH - START_EPOCH))"

cat > "${STATUS_JSON}.tmp" <<EOF
{
  "status": "SUCCESS",
  "backupId": "${BACKUP_ID}",
  "backupType": "${BACKUP_TYPE}",
  "databaseName": "${DB_NAME}",
  "timestamp": "${ISO_TIMESTAMP}",
  "lastBackupAt": "${ISO_TIMESTAMP}",
  "fileName": "${FINAL_FILE}",
  "backupFilename": "${FINAL_FILE}",
  "fileSizeBytes": ${FILE_SIZE},
  "sha256": "${SHA256}",
  "sha256Checksum": "${SHA256}",
  "compressed": ${COMPRESSED},
  "encrypted": ${ENCRYPTED},
  "durationSeconds": ${DURATION},
  "backupVersion": "${BACKUP_VERSION}",
  "verificationStatus": "VERIFIED",
  "failureReason": null
}
EOF
mv -f "${STATUS_JSON}.tmp" "$STATUS_JSON"
chmod 644 "$STATUS_JSON"

# Safe retention cleanup (never deletes latest backup, never touches phase6a artifacts, never fails backup)
if [[ "$BACKUP_RETENTION_DAYS" -gt 0 ]]; then
  while IFS= read -r old_file; do
    base="$(basename "$old_file")"
    if [[ "$base" == "$FINAL_FILE" || "$base" == "${FINAL_FILE}.sha256" || "$base" == *"phase6a"* ]]; then
      continue
    fi
    if [[ "$base" =~ ^tazatokri_backup_[0-9]{8}_[0-9]{6}\.sql(\.gz)?(\.enc)?(\.sha256)?$ ]]; then
      if [[ "$RETENTION_DRY_RUN" == "true" ]]; then
        log_msg "INFO" "[DRY-RUN] Would prune expired backup: $base"
      else
        rm -f "$old_file" && log_msg "INFO" "Pruned expired backup: $base" || true
      fi
    fi
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -mtime +"$BACKUP_RETENTION_DAYS" 2>/dev/null || true)
fi

log_msg "INFO" "Backup ${BACKUP_ID} completed and verified (${FILE_SIZE} bytes, sha256=${SHA256}, encrypted=${ENCRYPTED})"
