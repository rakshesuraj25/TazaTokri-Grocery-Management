#!/usr/bin/env bash
# TazaTokri Automated MySQL Backup Script (Linux / Docker / Production)
# Reads credentials exclusively from environment variables (DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD).
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-tazatokri}"
DB_USER="${DB_USERNAME:-root}"
BACKUP_DIR="${BACKUP_DIR:-./backend/data/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ISO_TIMESTAMP="$(date -Iseconds)"
BACKUP_FILE="tazatokri_backup_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
CHECKSUM_PATH="${BACKUP_PATH}.sha256"
LOG_PATH="${BACKUP_DIR}/backup.log"
STATUS_JSON="${BACKUP_DIR}/backup-status.json"

log_msg() {
  local level="$1"
  local msg="$2"
  echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $msg" | tee -a "$LOG_PATH"
}

log_msg "INFO" "Starting TazaTokri MySQL backup for ${DB_NAME} on ${DB_HOST}:${DB_PORT}"

export MYSQL_PWD="${DB_PASSWORD:-${MYSQL_PWD:-}}"
mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  --result-file="$BACKUP_PATH" \
  "$DB_NAME"

if [[ ! -s "$BACKUP_PATH" ]]; then
  log_msg "ERROR" "Backup file is empty or failed to create."
  exit 1
fi

FILE_SIZE="$(wc -c < "$BACKUP_PATH" | tr -d ' ')"
SHA256="$(sha256sum "$BACKUP_PATH" | awk '{print $1}')"
echo "${SHA256}  ${BACKUP_FILE}" > "$CHECKSUM_PATH"
chmod 600 "$BACKUP_PATH" "$CHECKSUM_PATH"

cat > "$STATUS_JSON" <<EOF
{
  "status": "SUCCESS",
  "timestamp": "${ISO_TIMESTAMP}",
  "fileName": "${BACKUP_FILE}",
  "fileSizeBytes": ${FILE_SIZE},
  "sha256": "${SHA256}",
  "retentionDays": ${BACKUP_RETENTION_DAYS}
}
EOF

find "$BACKUP_DIR" -name "tazatokri_backup_*.sql*" -type f -mtime +"$BACKUP_RETENTION_DAYS" -delete
log_msg "INFO" "Backup completed and verified (${FILE_SIZE} bytes, sha256=${SHA256})"
