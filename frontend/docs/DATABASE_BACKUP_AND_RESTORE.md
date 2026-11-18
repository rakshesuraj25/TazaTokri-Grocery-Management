# TazaTokri — MySQL Backup & Recovery Guide

## 1. Automated Backup Strategy

- **Scripts:**
  - Linux / Production: [`scripts/backup-mysql.sh`](../../scripts/backup-mysql.sh)
  - Windows: [`scripts/backup-mysql.ps1`](../../scripts/backup-mysql.ps1)
- **Credentials Security:** Scripts read `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, and `DB_PASSWORD` exclusively from environment variables (`MYSQL_PWD`). Never store database passwords in scripts or source code.
- **Frequency & Retention:**
  - Recommended production schedule: daily at `02:00 IST` via cron (`0 2 * * * /opt/tazatokri/scripts/backup-mysql.sh`).
  - Default retention: `14` days (`BACKUP_RETENTION_DAYS`), pruned **only after** verifying the new dump file exists and is non-empty.
- **Artifacts Generated:**
  - `tazatokri_backup_YYYYMMDD_HHMMSS.sql` (schema + all tables: customers, orders, order_items, payments, inventory, purchases, sales, suppliers, combos, saved_baskets, notification_preferences, notification_logs, ai_extraction_logs, delivery_attempts, delivery_otps, delivery_evidences, delivery_audit_logs)
  - `tazatokri_backup_YYYYMMDD_HHMMSS.sql.sha256`
  - `backup-status.json` (read by `GET /api/ops/health`)
  - `backup.log`
- **File Storage Backup:** Separately back up the private Proof-of-Delivery directory (`STORAGE_LOCAL_DIR`, e.g., `./backend/data/private-uploads`) or replicate the S3/R2 bucket.

---

## 2. Verification & Isolated Test Restore Procedure

**CRITICAL:** Never run restore tests against the live production database (`tazatokri` / `tazatokri_prod`). Both restore scripts include a safety guard that aborts if a live DB name is passed.

1. **Create & Verify Backup:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\backup-mysql.ps1
   ```
   ```bash
   ./scripts/backup-mysql.sh
   ```
2. **Restore into Isolated Test Database:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\restore-mysql-test.ps1 -TestDbName tazatokri_restore_test
   ```
   ```bash
   TEST_DB_NAME=tazatokri_restore_test ./scripts/restore-mysql-test.sh ./backend/data/backups/tazatokri_backup_YYYYMMDD_HHMMSS.sql
   ```
3. **Validate Restored Records:** Verify `SHOW TABLES;` and row counts on `users`, `vegetables`, `orders`, `stock_movements`, and `delivery_attempts`.

---

## 3. Encryption & Access Recommendations

- Restrict backup directory permissions (`chmod 700` on directory, `chmod 600` on `.sql` and `.sha256` files).
- Encrypt off-site backup copies at rest (e.g., S3/R2 SSE-S3 or `gpg --symmetric --cipher-algo AES256`) before uploading outside the host.
