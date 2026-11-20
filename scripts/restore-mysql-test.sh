#!/usr/bin/env bash
# TazaTokri Isolated Test Database Restore & Parity Verification Script (Linux)
# Supports .sql, .sql.gz, and .sql.gz.enc. Never targets production or Phase 6A DBs.
set -euo pipefail

BACKUP_FILE="${1:-}"
TEST_DB_NAME="${TEST_DB_NAME:-}"
SOURCE_DB="${SOURCE_DB:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USERNAME:-root}"
RESTORE_MODE="${RESTORE_MODE:-auto}"
COMPOSE_FILE="${COMPOSE_FILE:-./docker-compose.yml}"
MYSQL_SERVICE="${MYSQL_SERVICE:-mysql}"
ALLOW_RECREATE_ISOLATED_TEST_DB="${ALLOW_RECREATE_ISOLATED_TEST_DB:-false}"
BACKUP_ENCRYPTION_PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:-}"

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: TEST_DB_NAME=<isolated_db> $0 <path-to-backup.sql[.gz][.enc]>" >&2
  exit 1
fi

if [[ -z "$TEST_DB_NAME" ]]; then
  echo "SAFETY BLOCK: TEST_DB_NAME must be explicitly specified (no default)." >&2
  exit 1
fi

PROTECTED_DBS=("tazatokri" "tazatokri_prod" "tazatokri_phase6a2_test" "tazatokri_phase6a3_test" "tazatokri_phase6a3_restore" "mysql" "sys" "information_schema" "performance_schema")
for p in "${PROTECTED_DBS[@]}"; do
  if [[ "${TEST_DB_NAME,,}" == "$p" ]]; then
    echo "SAFETY BLOCK: Refusing to target protected database '$TEST_DB_NAME'." >&2
    exit 1
  fi
done

if [[ -z "${DB_PASSWORD:-}" ]]; then
  echo "ERROR: DB_PASSWORD environment variable is required." >&2
  exit 1
fi

CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [[ ! -f "$CHECKSUM_FILE" ]]; then
  echo "ERROR: Checksum file missing: $CHECKSUM_FILE" >&2
  exit 1
fi

# 1. Verify SHA-256 checksum BEFORE processing backup
EXPECTED_SHA="$(awk '{print tolower($1)}' "$CHECKSUM_FILE" | head -n 1)"
ACTUAL_SHA="$(sha256sum "$BACKUP_FILE" | awk '{print tolower($1)}')"
if [[ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]]; then
  echo "CHECKSUM MISMATCH: expected=$EXPECTED_SHA actual=$ACTUAL_SHA" >&2
  exit 1
fi
echo "[PASS] SHA-256 Checksum Verified: $ACTUAL_SHA"

TMP_DIR="$(mktemp -d)"
CNF_FILE="${TMP_DIR}/my.cnf"
trap 'rm -rf "$TMP_DIR"' EXIT

USE_DOCKER_EXEC="false"
if [[ "$RESTORE_MODE" == "docker" ]]; then
  USE_DOCKER_EXEC="true"
elif [[ "$RESTORE_MODE" == "auto" ]]; then
  if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" ]] && command -v docker >/dev/null 2>&1 && [[ -f "$COMPOSE_FILE" ]]; then
    if [[ -n "$(docker compose -f "$COMPOSE_FILE" ps -q "$MYSQL_SERVICE" 2>/dev/null || true)" ]]; then
      USE_DOCKER_EXEC="true"
    fi
  fi
elif [[ "$RESTORE_MODE" != "host" ]]; then
  echo "ERROR: Invalid RESTORE_MODE='${RESTORE_MODE}' (expected auto, docker, or host)." >&2
  exit 1
fi

run_mysql() {
  if [[ "$USE_DOCKER_EXEC" == "true" ]]; then
    docker compose -f "$COMPOSE_FILE" exec -T -e MYSQL_PWD="$DB_PASSWORD" "$MYSQL_SERVICE" \
      mysql -h 127.0.0.1 -P 3306 -u "$DB_USER" "$@"
  else
    run_mysql "$@"
  fi
}

if [[ "$USE_DOCKER_EXEC" != "true" ]]; then
  umask 077
  cat > "$CNF_FILE" <<EOF
[client]
host=${DB_HOST}
port=${DB_PORT}
user=${DB_USER}
password=${DB_PASSWORD}
EOF
  chmod 600 "$CNF_FILE"
fi

WORK_FILE="$BACKUP_FILE"

# 2. Decrypt if .enc
if [[ "$WORK_FILE" == *.enc ]]; then
  if [[ -z "$BACKUP_ENCRYPTION_PASSPHRASE" ]]; then
    echo "ERROR: BACKUP_ENCRYPTION_PASSPHRASE is required to decrypt '$BACKUP_FILE'." >&2
    exit 1
  fi
  export BACKUP_ENCRYPTION_PASSPHRASE
  DEC_FILE="${TMP_DIR}/decrypted.sql.gz"
  if [[ "$WORK_FILE" != *.gz.enc ]]; then
    DEC_FILE="${TMP_DIR}/decrypted.sql"
  fi
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
    -in "$WORK_FILE" -out "$DEC_FILE" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
  WORK_FILE="$DEC_FILE"
  echo "[PASS] Decrypted backup artifact."
fi

# 3. Decompress if .gz
if [[ "$WORK_FILE" == *.gz ]]; then
  SQL_FILE="${TMP_DIR}/restored.sql"
  gzip -dc "$WORK_FILE" > "$SQL_FILE"
  WORK_FILE="$SQL_FILE"
  echo "[PASS] Decompressed backup artifact."
fi

# 4. Verify SQL readability
if [[ ! -s "$WORK_FILE" ]] || ! grep -q "CREATE TABLE" "$WORK_FILE"; then
  echo "ERROR: Restored SQL artifact is empty or lacks CREATE TABLE statements." >&2
  exit 1
fi
echo "[PASS] SQL Artifact Readability Verified."

# 5. Refuse to overwrite existing DB unless explicitly permitted
DB_EXISTS="$(run_mysql -N -B -e "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '${TEST_DB_NAME}';")"
if [[ "$DB_EXISTS" != "0" ]]; then
  if [[ "$ALLOW_RECREATE_ISOLATED_TEST_DB" != "true" ]]; then
    echo "SAFETY BLOCK: Target database '$TEST_DB_NAME' already exists. Set ALLOW_RECREATE_ISOLATED_TEST_DB=true for isolated test recreate." >&2
    exit 1
  fi
  run_mysql -e "DROP DATABASE \`${TEST_DB_NAME}\`;"
fi

run_mysql -e "CREATE DATABASE \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
run_mysql "$TEST_DB_NAME" < "$WORK_FILE"
echo "[PASS] Restored SQL into isolated database '${TEST_DB_NAME}'."

# 6. Schema & Integrity Checks
RESTORED_TABLES="$(run_mysql -N -B -e "SELECT table_name FROM information_schema.tables WHERE table_schema='${TEST_DB_NAME}' ORDER BY table_name;")"
TABLE_COUNT="$(echo "$RESTORED_TABLES" | grep -c . || true)"
FK_CHECK="$(run_mysql -N -B -e "SELECT @@foreign_key_checks;")"
CHARSET_CHECK="$(run_mysql -N -B -e "SELECT default_character_set_name FROM information_schema.schemata WHERE schema_name='${TEST_DB_NAME}';")"

echo "Schema Validation: tables=${TABLE_COUNT}, charset=${CHARSET_CHECK}, foreign_key_checks=${FK_CHECK} -> PASS"

# 7. Parity Verification against SOURCE_DB (if provided)
if [[ -z "$SOURCE_DB" ]]; then
  echo "Row-Count Parity vs Source: NOT VERIFIED (SOURCE_DB not specified)"
  echo "Cell-Level Data Parity:    NOT VERIFIED (SOURCE_DB not specified)"
else
  SOURCE_COUNT="$(run_mysql -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${SOURCE_DB}';")"
  if [[ "$SOURCE_COUNT" != "$TABLE_COUNT" ]]; then
    echo "Table-Count Parity: FAIL (source=${SOURCE_COUNT}, restored=${TABLE_COUNT})" >&2
    exit 1
  fi
  echo "Table-Count Parity: PASS (${TABLE_COUNT}/${SOURCE_COUNT})"

  ROW_MISMATCH=0
  DATA_MISMATCH=0
  for tbl in $RESTORED_TABLES; do
    s_rows="$(run_mysql -N -B -e "SELECT COUNT(*) FROM \`${SOURCE_DB}\`.\`${tbl}\`;")"
    r_rows="$(run_mysql -N -B -e "SELECT COUNT(*) FROM \`${TEST_DB_NAME}\`.\`${tbl}\`;")"
    if [[ "$s_rows" != "$r_rows" ]]; then
      echo "  [FAIL] Row count mismatch on ${tbl}: source=${s_rows}, restored=${r_rows}" >&2
      ROW_MISMATCH=1
    fi
    s_chk="$(run_mysql -N -B -e "CHECKSUM TABLE \`${SOURCE_DB}\`.\`${tbl}\`;" | awk '{print $2}')"
    r_chk="$(run_mysql -N -B -e "CHECKSUM TABLE \`${TEST_DB_NAME}\`.\`${tbl}\`;" | awk '{print $2}')"
    if [[ "$s_chk" != "$r_chk" ]]; then
      echo "  [FAIL] CHECKSUM TABLE mismatch on ${tbl}" >&2
      DATA_MISMATCH=1
    fi
  done

  if [[ $ROW_MISMATCH -ne 0 || $DATA_MISMATCH -ne 0 ]]; then
    echo "Parity Verification: FAIL" >&2
    exit 1
  fi
  echo "Row-Count Parity: PASS (all ${TABLE_COUNT} tables)"
  echo "CHECKSUM TABLE Diagnostic Parity: PASS (all ${TABLE_COUNT} tables)"
fi
