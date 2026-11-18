#!/usr/bin/env bash
# TazaTokri Isolated Test Database Restore & Verification Script
# Never targets the live production database.
set -euo pipefail

BACKUP_FILE="${1:-}"
TEST_DB_NAME="${TEST_DB_NAME:-tazatokri_restore_test}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USERNAME:-root}"

if [[ "$TEST_DB_NAME" == "tazatokri" || "$TEST_DB_NAME" == "tazatokri_prod" ]]; then
  echo "SAFETY BLOCK: Refusing to restore into live database '$TEST_DB_NAME'." >&2
  exit 1
fi

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <path-to-backup.sql>" >&2
  exit 1
fi

sha256sum -c "${BACKUP_FILE}.sha256"

export MYSQL_PWD="${DB_PASSWORD:-${MYSQL_PWD:-}}"
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" -e "DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\`; CREATE DATABASE \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$TEST_DB_NAME" < "$BACKUP_FILE"
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$TEST_DB_NAME" -e "SHOW TABLES;"
echo "Isolated restore test into '${TEST_DB_NAME}' succeeded."
