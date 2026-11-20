# TazaTokri Production Rollback & Disaster Recovery Plan

This document defines the safe production rollback procedures for TazaTokri, aligned with versioned Docker images (`APP_VERSION`), internal container health checks, and encrypted MySQL backups (`.sql.gz.enc`).

---

## 1. Rollback Decision Matrix

| Severity | Symptom | Recommended Action |
|---|---|---|
| **SEV-1 (Schema/Data Corruption)** | Flyway migration failed midway, destructive DDL corrupted schema, or severe data corruption occurred. | **Separate Manual Disaster-Recovery Procedure:** Stop `backend`, review impact, and manually restore a verified `.sql.gz.enc` backup before starting the prior `APP_VERSION`. |
| **SEV-2 (Application Regression)** | New release fails startup/readiness or breaks app behavior, while database schema remains valid or backward-compatible. | **Application-Only Rollback:** Run `APP_VERSION=<previous> bash scripts/rollback-prod.sh` using retained local images (`--no-build`). **Do NOT restore the database.** |
| **SEV-3 (Minor UI/Copy Defect)** | Minor styling or translation issue. | **Fix forward** via normal `scripts/deploy-prod.sh` release. |

> **CRITICAL WARNING:** Never run a database restore for an ordinary application or UI bug. Restoring an earlier backup **permanently discards** orders, payments, stock movements, and user changes recorded after that backup was taken.

---

## 2. Application-Only Rollback (`scripts/rollback-prod.sh`)

Use `scripts/rollback-prod.sh` when the database does **not** need restoration and you want to switch `backend` and `frontend` back to a previously deployed `APP_VERSION` without rebuilding from source.

### Command Example
```bash
cd /opt/tazatokri
APP_VERSION=0.4.0 bash scripts/rollback-prod.sh
```

### Verified Script Behavior
1. **Explicit `APP_VERSION` Required:** `APP_VERSION` must be supplied explicitly (never guessed, never `latest`).
2. **Pre-Rollback Image Check:** Verifies both `tazatokri-backend:${APP_VERSION}` and `tazatokri-frontend:${APP_VERSION}` exist locally via `docker image inspect` **before** altering any running container. If either image is missing, the script aborts.
3. **No Rebuild / No MySQL Restart:** Executes `docker compose up -d --no-build backend frontend`, preserving `mysql`, volumes, and prior image tags.
4. **Bounded Health Verification:**
   - Polls backend readiness inside the `backend` container (`http://localhost:8080/actuator/health/readiness`) up to `HEALTH_MAX_ATTEMPTS` (default `24`) every `HEALTH_POLL_SECONDS` (default `5`s), requiring `"UP"`.
   - Polls frontend health inside the `frontend` container (`http://localhost:80/nginx-health`) up to `24` attempts every `5`s, requiring `ok`.
5. **Failure Handling:** Both checks must pass for rollback success. If either fails, the script logs the failed stage and target `APP_VERSION`, warns that the application is unhealthy, exits non-zero, and **never** attempts a second automatic rollback or database restore.

### PWA Service Worker Cache Note
`frontend` uses Workbox PWA caching (`vite.config.ts`). Switching back to the previous `frontend` image serves its previous `sw.js` revision; connected clients update on next navigation/reload (`Ctrl + Shift + R` if a user reports cached assets).

---

## 3. Flyway Migration Risk & Compatibility

- Spring Boot executes Flyway migrations (`V1`–`V4`+) **automatically at backend startup** (`spring.flyway.enabled=true`) and validates entities against the schema (`spring.jpa.hibernate.ddl-auto=validate`).
- **Application-only rollback does NOT reverse Flyway database migrations.**
- If a new release applied a breaking DDL change (e.g., dropping/renaming a column or adding a non-nullable column without a default), rolling back to an older `APP_VERSION` image may fail Hibernate schema validation (`ddl-auto=validate`) or runtime queries.
- **Best Practice:** Keep production Flyway migrations backward-compatible (expand-and-contract) whenever possible so application-only rollback remains viable without DB restoration.

---

## 4. Encrypted Backups (`scripts/backup-mysql.sh` & `scripts/backup-uploads.sh`)

Production backups created by `scripts/backup-mysql.sh` use the following pipeline:
- **Internal-Only MySQL Dump:** Supports `BACKUP_MODE=docker` (via `docker compose exec -T -e MYSQL_PWD=... mysql mysqldump` so MySQL port `3306` never needs to be published on the host) as well as `BACKUP_MODE=host` (`--defaults-extra-file`, `chmod 600`), using `--single-transaction --routines --triggers --events --hex-blob --set-gtid-purged=OFF --default-character-set=utf8mb4`.
- **Compression:** `gzip -9` + `gzip -t` integrity check (`.sql.gz`).
- **Encryption at Rest:** Mandatory in `BACKUP_ENV=production` for **both** MySQL (`scripts/backup-mysql.sh`) and POD uploads (`scripts/backup-uploads.sh`) via OpenSSL `aes-256-cbc -pbkdf2 -iter 100000 -salt` using `BACKUP_ENCRYPTION_PASSPHRASE` (`.sql.gz.enc` / `.tar.gz.enc`).
- **Naming Convention:** `tazatokri_backup_YYYYMMDD_HHMMSS.sql.gz.enc` (and `tazatokri_uploads_YYYYMMDD_HHMMSS.tar.gz.enc`) + separate `<artifact>.sha256` checksum file (`chmod 600` in `chmod 700` backup directory).
- **Separated Status Metadata & Retention:** Updates `backup-status.json` (`chmod 644` in `./backend/data/backup-status/`, mounted `:ro` into `backend` so encrypted archives are never exposed to the application container), consumed by `GET /api/ops/health`. Retention pruning removes only matching `tazatokri_backup_*` / `tazatokri_uploads_*` files older than `BACKUP_RETENTION_DAYS` (default `14`) while preserving the newest valid backup.
- **Isolated Restore Verification:** `scripts/restore-mysql-test.sh` supports `RESTORE_MODE=docker` to test `.sql.gz.enc` restores into an isolated test schema inside `mysql` without publishing port `3306` and explicitly blocks `tazatokri`, `tazatokri_prod`, and `phase6a` schemas.

---

## 5. Disaster Recovery (Database Restoration Concept)

> **IMPORTANT:** Production database restoration is a **separate manual disaster-recovery procedure** requiring explicit operator review. Do **NOT** use `scripts/restore-mysql-test.sh` for production — it is strictly for isolated test targets and intentionally blocks `tazatokri` and `tazatokri_prod`.

When schema corruption or unrecoverable data loss requires restoring a pre-deploy backup:
1. **Halt Application Writes:** Stop the `backend` container (`docker compose stop backend`) so no new orders/payments mutate the database.
2. **Verify Backup Integrity First:** Confirm the `.sha256` checksum of the chosen `.sql.gz.enc` artifact matches before decrypting (`sha256sum -c <artifact>.sha256`).
3. **Decrypt & Decompress Safely:** Decrypt using the independently stored `BACKUP_ENCRYPTION_PASSPHRASE` (`openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000`) and decompress (`gzip -dc`) into a protected temporary file (`chmod 600`), verifying SQL readability before applying.
4. **Restore & Reconcile:** Restore into the target MySQL instance under operator supervision, clean up temporary plaintext SQL immediately afterward, start the matching `APP_VERSION` (`APP_VERSION=<matching_version> bash scripts/rollback-prod.sh`), and verify `/actuator/health/readiness` and `/nginx-health`.
5. **Post-Incident Reconciliation:** Reconcile any Razorpay payments or orders that occurred between the backup timestamp and the outage using the Razorpay Dashboard and staff ledger.

---

## 6. Failure Scenario Quick Reference

| Failure Scenario | Immediate Action |
|---|---|
| **Backend startup failure (no breaking DDL)** | Inspect `docker compose logs backend`; roll back with `APP_VERSION=<prev> bash scripts/rollback-prod.sh`. |
| **Frontend startup / Nginx failure** | Inspect `docker compose logs frontend`; verify `infra/certs/` and `infra/nginx/default.conf`, or roll back with `rollback-prod.sh`. |
| **Health-check timeout during deploy** | Check `docker compose ps` and `docker compose logs backend mysql`; confirm whether MySQL is slow/recovering before deciding to roll back. |
| **Application bug after successful deploy** | Use application-only rollback (`rollback-prod.sh`); do **not** restore the database. |
| **Flyway migration failure (`success=0`)** | Stop `backend`; inspect `flyway_schema_history` and logs; execute manual disaster-recovery restore of pre-deploy `.sql.gz.enc` backup if partial DDL occurred. |
| **Old image incompatible with new schema** | Do **not** force older image; either fix forward with a new release or perform reviewed manual disaster-recovery restore to the pre-migration backup. |
