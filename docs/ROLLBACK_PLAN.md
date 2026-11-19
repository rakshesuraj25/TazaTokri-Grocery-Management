# TazaTokri Production Rollback & Disaster Recovery Plan

This document outlines the standard operating procedures for executing a quick, safe, and zero-data-loss rollback in the event of an unhealthy release or severe production anomaly.

---

## 1. Rollback Triggers & Severity Classification

| Severity Level | Anomaly Description | Action Required |
|---|---|---|
| **SEV-1 (Critical)** | Backend in crash-loop (`CrashLoopBackOff`), database migration failed or corrupted schema, order checkout failing 100% of the time, or data corruption detected. | **Immediate Full Rollback** (Code + Database Restore if schema corrupted). |
| **SEV-2 (Major)** | Core feature degraded (e.g., Quick Sale POS failing, delivery OTP not issuing, receipt printing broken), but database remains consistent and catalog browsing works. | **Application Rollback** (Revert backend/frontend images to previous stable release; keep database intact). |
| **SEV-3 (Minor)** | Minor styling glitch, translation typo, or edge-case UI reporting bug. | **Hotfix via normal deploy** (No rollback needed). |

---

## 2. Fast Application Rollback (Zero DB Impact)

Use this procedure when the database schema has **not** been corrupted and the issue is strictly application code or frontend bundling.

### Step 2.1: Revert Code to Previous Git Tag or Commit
```bash
cd /opt/tazatokri

# Checkout previous stable release tag (e.g., v0.4.0)
git checkout v0.4.0

# Or revert the last commit:
# git revert HEAD --no-edit
```

### Step 2.2: Rebuild & Restart Containers
```bash
docker compose up -d --build backend frontend
```

### Step 2.3: Invalidate PWA Service Worker Cache
The frontend PWA utilizes Workbox. When rolling back:
1. The new deployment serves `dist/sw.js` with an updated revision hash.
2. Browsers running the app will receive the `controllerchange` event and prompt the user or automatically refresh to load the reverted assets.
3. If users report stale UI, instruct them to perform a hard refresh (`Ctrl + Shift + R` or `Cmd + Shift + R`).

---

## 3. Database Schema Rollback & Point-in-Time Restore

If a failed deployment executed destructive DDL or introduced corrupted rows, follow this disaster recovery procedure.

### Step 3.1: Stop Web Traffic & Backend Container
Prevent new orders and writes from entering the database:
```bash
cd /opt/tazatokri
docker compose stop backend
```

### Step 3.2: Identify Latest Verified Backup File
Backups are archived in the named volume `/app/data/backups` or the host backup directory:
```bash
ls -lh /opt/tazatokri/backend/data/backups/tazatokri_backup_*.sql
```
Verify SHA-256 integrity of the chosen backup file:
```bash
sha256sum -c /opt/tazatokri/backend/data/backups/tazatokri_backup_20261119_221508.sql.sha256
```
Must return `OK`.

### Step 3.3: Restore Database Dump into MySQL Container
Restore the clean SQL dump:
```bash
# Load environment variables to obtain DB credentials
source .env

# Execute restore via Docker container pipe
docker compose exec -T mysql mysql -u root -p"$DB_ROOT_PASSWORD" "$DB_NAME" < /opt/tazatokri/backend/data/backups/tazatokri_backup_20261119_221508.sql
```

### Step 3.4: Repair Flyway Schema Table (If Required)
If a migration failed midway or recorded an erroneous checksum:
```bash
# Check flyway history table
docker compose exec -T mysql mysql -u root -p"$DB_ROOT_PASSWORD" -e "SELECT installed_rank, version, description, success FROM tazatokri.flyway_schema_history;"

# If a failed migration is recorded (success = 0), delete the failed row:
docker compose exec -T mysql mysql -u root -p"$DB_ROOT_PASSWORD" -e "DELETE FROM tazatokri.flyway_schema_history WHERE success = 0;"
```

### Step 3.5: Restart Application & Verify Health
```bash
# Rebuild previous stable backend image
git checkout v0.4.0
docker compose up -d --build backend

# Verify health endpoint
curl -I http://localhost:8080/actuator/health
```

---

## 4. Emergency Communications & Post-Incident Review

1. **Staff & Delivery Operations:** Notify staff via WhatsApp/phone that orders from the incident window must be reconciled against counter sales ledger.
2. **Pending Online Payments:** For any Razorpay payment captured during the rollback window, check the Razorpay Dashboard and manually issue refunds or fulfill orders in the admin panel.
3. **Post-Mortem:** Conduct root cause analysis within 24 hours and document corrective actions before re-attempting deployment.
