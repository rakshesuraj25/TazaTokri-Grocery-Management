# TazaTokri Disaster Recovery Runbook

For routine application-only rollbacks (SEV-2), use [ROLLBACK_PLAN.md](ROLLBACK_PLAN.md) (`scripts/rollback-prod.sh`). **Never** restore a database backup for a routine application bug.

**Targets (Theoretical — unproven until live VPS restore drill completes):**
- **Target RPO:** `<= 24 hours`
- **Target RTO:** `<= 2 hours`

---

## 1. Prerequisites & Required Artifacts

- **Offsite Backup Repository:** Encrypted `.sql.gz.enc`, `.tar.gz.enc`, and `.sha256` files from S3/`rclone`.
- **Escrowed Secret:** `BACKUP_ENCRYPTION_PASSPHRASE` (stored independently of the VPS).
- **Production `.env` & Code:** Git repository at the matching `APP_VERSION` tag + `.env` secrets.

---

## 2. Recovery Procedures by Scenario

### A. Complete VPS Failure (Rebuild From Scratch)
1. Provision fresh Ubuntu 24.04 LTS VPS, configure SSH/UFW (`22`, `80`, `443`), install Docker Engine, Compose plugin, and Certbot.
2. Update DNS `A` records (`@`, `www`) to the new VPS IPv4.
3. Clone `/opt/tazatokri`, restore `.env` (`chmod 600`), create host directories (`1001:1001` on `private-uploads`), and run `scripts/tls-bootstrap.sh`.
4. Pull/copy the latest verified `.sql.gz.enc`, `.tar.gz.enc`, and `.sha256` files from offsite storage.
5. Verify `.sha256` checksums (`sha256sum -c`).
6. Start `mysql` (`docker compose up -d mysql`), wait for healthy, decrypt & decompress the SQL backup into a `chmod 600` temp file, restore into `tazatokri`, and **immediately shred/remove** the plaintext SQL temp file.
7. Restore POD uploads into `./backend/data/private-uploads` (`chown -R 1001:1001`).
8. Deploy the matching `APP_VERSION` (`docker compose up -d backend frontend`), verify `/actuator/health/readiness` and `/nginx-health`, and reconcile any orders/payments since the backup timestamp via Razorpay Dashboard.

### B. MySQL Corruption or Accidental Data Deletion
1. Stop `backend` immediately (`docker compose stop backend`) to halt writes.
2. Take an emergency copy/dump of current state if readable for forensics.
3. Verify `.sha256` of the chosen pre-incident `.sql.gz.enc` backup, decrypt (`openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000`), decompress (`gzip -dc`), and restore into `tazatokri` under operator supervision.
4. Remove plaintext temp SQL, start `backend`, verify readiness, and reconcile post-backup transactions.
- **Data-loss risk:** Transactions committed after the selected backup timestamp are lost.

### C. Failed Database Migration (`Flyway success=0`)
1. Stop `backend` (`docker compose stop backend`).
2. Inspect `flyway_schema_history` and `backend` logs.
3. Restore the **pre-deploy** `.sql.gz.enc` backup taken by `scripts/deploy-prod.sh`, then start the previous `APP_VERSION` via `APP_VERSION=<prev> bash scripts/rollback-prod.sh`.

### D. Application Deployment Failure
1. If no breaking DDL occurred, run `APP_VERSION=<prev> bash scripts/rollback-prod.sh` (application-only, no DB restore).

### E. Compromised Credentials
1. Rotate affected secrets in `.env` (`DB_APP_PASSWORD`, `DB_ROOT_PASSWORD`, `JWT_SECRET`, Razorpay keys, `BACKUP_ENCRYPTION_PASSPHRASE`), recreate affected containers, and audit logs (see [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)).

### F. Lost Encryption Passphrase
- **Impact:** Encrypted `.sql.gz.enc` / `.tar.gz.enc` files cannot be decrypted.
- **Action:** If live MySQL is still running, immediately take a new backup with a newly generated and escrowed passphrase; if both VPS and passphrase are lost, backups are unrecoverable.

### G. TLS Certificate Failure
1. If `tls-renew.sh` failed, existing certs in `./infra/certs/` remain valid until expiry. Fix DNS/port-80/webroot issue and re-run `DOMAIN=<domain> bash scripts/tls-renew.sh`.

### H. Disk Exhaustion
1. Check `df -h` and `du -sh /opt/tazatokri/backend/data/* /var/lib/docker`.
2. Remove only expired logs or verified-synced old local backups (never delete the newest valid backup or `mysql_data`). Expand VPS volume if data growth is legitimate.
