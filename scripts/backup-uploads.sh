#!/usr/bin/env bash
# TazaTokri Proof-of-Delivery (POD) Uploads Backup Script (Linux / Docker / Production)
# Archives STORAGE_LOCAL_DIR preserving relative paths without modifying originals.
set -euo pipefail

UPLOADS_DIR="${UPLOADS_DIR:-./backend/data/private-uploads}"
BACKUP_DIR="${BACKUP_DIR:-./backend/data/backups/uploads}"
BACKUP_ENV="${BACKUP_ENV:-production}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_ENCRYPTION_PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:-}"
ALLOW_UNENCRYPTED_NONPROD="${ALLOW_UNENCRYPTED_NONPROD:-false}"
RETENTION_DRY_RUN="${RETENTION_DRY_RUN:-false}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ISO_TIMESTAMP="$(date -Iseconds)"
STATUS_JSON="${UPLOADS_STATUS_FILE:-${BACKUP_DIR}/uploads-backup-status.json}"
VERIFICATION_STATUS="FAILED"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" || true

write_status() {
  local status="$1" file_name="$2" size_bytes="$3" sha="$4" encrypted="$5" verify="$6" reason="$7"
  mkdir -p "$(dirname "$STATUS_JSON")"
  cat > "${STATUS_JSON}.tmp" <<EOF
{
  "status": "${status}",
  "timestamp": "${ISO_TIMESTAMP}",
  "fileName": ${file_name},
  "fileSizeBytes": ${size_bytes},
  "sha256": ${sha},
  "encrypted": ${encrypted},
  "verificationStatus": "${verify}",
  "failureReason": ${reason}
}
EOF
  mv -f "${STATUS_JSON}.tmp" "$STATUS_JSON"
  chmod 644 "$STATUS_JSON"
}

TMP_DIR="$(mktemp -d)"
cleanup() {
  local exit_code=$?
  rm -rf "$TMP_DIR"
  if [[ $exit_code -ne 0 && "$VERIFICATION_STATUS" != "VERIFIED" ]]; then
    write_status "FAILED" "null" 0 "null" "false" "FAILED" "\"Uploads backup aborted with exit code ${exit_code}\""
  fi
}
trap cleanup EXIT

if [[ ! -d "$UPLOADS_DIR" ]]; then
  echo "ERROR: Uploads directory '$UPLOADS_DIR' does not exist." >&2
  write_status "FAILED" "null" 0 "null" "false" "FAILED" "\"Missing uploads directory\""
  exit 1
fi

if [[ -z "$BACKUP_ENCRYPTION_PASSPHRASE" ]]; then
  if [[ "$BACKUP_ENV" == "production" || "$ALLOW_UNENCRYPTED_NONPROD" != "true" ]]; then
    echo "ERROR: BACKUP_ENCRYPTION_PASSPHRASE is required in production mode (no unencrypted fallback)." >&2
    write_status "FAILED" "null" 0 "null" "false" "FAILED" "\"Missing BACKUP_ENCRYPTION_PASSPHRASE\""
    exit 1
  fi
fi

TAR_NAME="tazatokri_uploads_${TIMESTAMP}.tar.gz"
TMP_TAR="${TMP_DIR}/${TAR_NAME}"
FINAL_NAME="$TAR_NAME"
FINAL_TMP="$TMP_TAR"
ENCRYPTED="false"

tar -C "$UPLOADS_DIR" --exclude='*.tmp' --exclude='.DS_Store' -czf "$TMP_TAR" .
if [[ ! -s "$TMP_TAR" ]] || ! gzip -t "$TMP_TAR"; then
  echo "ERROR: Uploads archive creation or gzip integrity check failed." >&2
  exit 1
fi

if [[ -n "$BACKUP_ENCRYPTION_PASSPHRASE" ]]; then
  export BACKUP_ENCRYPTION_PASSPHRASE
  FINAL_NAME="${TAR_NAME}.enc"
  FINAL_TMP="${TMP_DIR}/${FINAL_NAME}"
  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
    -in "$TMP_TAR" -out "$FINAL_TMP" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
  if [[ ! -s "$FINAL_TMP" ]]; then
    echo "ERROR: OpenSSL encryption of uploads archive failed." >&2
    exit 1
  fi
  rm -f "$TMP_TAR"
  ENCRYPTED="true"
fi

SHA256="$(sha256sum "$FINAL_TMP" | awk '{print $1}')"
echo "${SHA256}  ${FINAL_NAME}" > "${FINAL_TMP}.sha256"
if ! (cd "$TMP_DIR" && sha256sum -c "${FINAL_NAME}.sha256" >/dev/null 2>&1); then
  echo "ERROR: SHA-256 verification failed on temporary uploads archive." >&2
  exit 1
fi

DEST_PATH="${BACKUP_DIR}/${FINAL_NAME}"
DEST_SHA="${DEST_PATH}.sha256"
mv "$FINAL_TMP" "$DEST_PATH"
mv "${FINAL_TMP}.sha256" "$DEST_SHA"
chmod 600 "$DEST_PATH" "$DEST_SHA"

FILE_SIZE="$(wc -c < "$DEST_PATH" | tr -d ' ')"
VERIFICATION_STATUS="VERIFIED"
write_status "SUCCESS" "\"${FINAL_NAME}\"" "$FILE_SIZE" "\"${SHA256}\"" "$ENCRYPTED" "VERIFIED" "null"

# Safe retention pruning (never deletes newest valid backup)
if [[ "$BACKUP_RETENTION_DAYS" -gt 0 ]]; then
  while IFS= read -r old_file; do
    base="$(basename "$old_file")"
    if [[ "$base" == "$FINAL_NAME" || "$base" == "${FINAL_NAME}.sha256" ]]; then
      continue
    fi
    if [[ "$base" =~ ^tazatokri_uploads_[0-9]{8}_[0-9]{6}\.tar\.gz(\.enc)?(\.sha256)?$ ]]; then
      if [[ "$RETENTION_DRY_RUN" == "true" ]]; then
        echo "INFO: [DRY-RUN] Would prune expired upload backup: $base"
      else
        rm -f "$old_file" && echo "INFO: Pruned expired upload backup: $base" || true
      fi
    fi
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -mtime +"$BACKUP_RETENTION_DAYS" 2>/dev/null || true)
fi

echo "POD upload backup completed and verified: ${DEST_PATH} (sha256=${SHA256}, encrypted=${ENCRYPTED})"
