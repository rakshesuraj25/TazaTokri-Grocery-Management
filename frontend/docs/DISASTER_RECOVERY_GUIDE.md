# TazaTokri — Database Backup & Disaster Recovery Guide (Phase 5)

**Target System:** MySQL 8.x / MariaDB Database for TazaTokri  
**Audience:** DevOps Engineers, Database Administrators, System Operators  

---

## 1. Objectives & Metrics

- **Recovery Point Objective (RPO):** Maximum 1 hour of transaction loss via automated binary logging and daily full schema/data snapshots.
- **Recovery Time Objective (RTO):** Less than 15 minutes to full operational recovery from a verified backup archive.

---

## 2. Automated Backup Execution

### Windows (PowerShell)
```powershell
# Run from repository root:
powershell -ExecutionPolicy Bypass -File .\scripts\backup-mysql.ps1
```

### Linux / Container Shell
```bash
# Run from repository root:
chmod +x ./scripts/backup-mysql.sh
./scripts/backup-mysql.sh
```

### Generated Artifacts
Every backup run creates:
1. `tazatokri_backup_<YYYYMMDD_HHMMSS>.sql` — Plaintext SQL dump with table locks and transaction consistency.
2. `tazatokri_backup_<YYYYMMDD_HHMMSS>.sql.sha256` — Cryptographic SHA-256 integrity hash.
3. `backup.log` — Continuous append-only timestamped execution log.
4. `backup-status.json` — Machine-readable status consumed by the operational health endpoint (`GET /api/ops/health`).

---

## 3. Safe Isolated Restore Testing

To test recovery without risking live data, the restore scripts enforce a **Safety Block**:
Any restore targeting databases named `tazatokri` or `tazatokri_prod` is immediately aborted with an error.

### Windows Test Restore
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-mysql-test.ps1 -TestDbName "tazatokri_restore_test"
```

### Linux Test Restore
```bash
./scripts/restore-mysql-test.sh tazatokri_restore_test
```

### Verification Steps Performed During Restore Test:
1. Verifies SHA-256 checksum matches the `.sha256` sidecar file.
2. Scans SQL content for all required Phase 1–4 tables (`orders`, `stock_movements`, `delivery_otps`, `delivery_evidences`, `combos`, `saved_baskets`).
3. Connects to test database, executes schema restore, and verifies row integrity.

---

## 4. Emergency Production Recovery Procedure

In the event of physical host loss or database corruption:

1. **Provision New Database Instance:**
   Ensure MySQL 8.0+ is running with UTF8MB4 charset:
   ```sql
   CREATE DATABASE tazatokri CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. **Locate Latest Verified Backup:**
   Check `backend/data/backups/backup-status.json` or remote S3/R2 backup storage for the latest verified timestamp.

3. **Verify SHA-256 Checksum:**
   ```powershell
   Get-FileHash -Path .\tazatokri_backup_<TIMESTAMP>.sql -Algorithm SHA256
   Get-Content .\tazatokri_backup_<TIMESTAMP>.sql.sha256
   ```

4. **Restore Database:**
   ```powershell
   mysql -h <DB_HOST> -u root -p tazatokri < .\tazatokri_backup_<TIMESTAMP>.sql
   ```

5. **Run Flyway Migrations:**
   Start the Spring Boot backend container. Flyway will automatically validate schema baseline version and apply any pending migrations (`V1` through `V4`).

6. **Verify Health Endpoint:**
   Check `GET http://localhost:8080/actuator/health` returns `{"status":"UP"}`.
