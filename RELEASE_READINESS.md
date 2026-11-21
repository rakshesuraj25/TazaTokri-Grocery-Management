# TazaTokri — Release Readiness Summary

## 1. Release Verdict
**READY WITH CONDITIONS** — All backend unit suites (`43/43`), TypeScript checks, production Vite bundle, and feature Vitest suites pass after the release-blocker fixes. Live staging infrastructure verification (MySQL Flyway execution, Docker Compose startup, and live Razorpay/WhatsApp callbacks) remains a pre-production launch gate.

## 2. Deployment Prerequisites
- Populate all required production environment variables listed in [ENVIRONMENT_VARIABLES.md](file:///C:/Taza_Tokri/ENVIRONMENT_VARIABLES.md).
- Ensure writable host directories exist for `STORAGE_LOCAL_DIR` (`/app/data/private-uploads`) and `APP_BACKUP_DIR` (`/app/data/backups`) in [docker-compose.yml](file:///C:/Taza_Tokri/docker-compose.yml).
- Confirm `spring.profiles.active=prod` is active so hardcoded secret fallbacks are disabled and `/actuator/health` hides internal details.

## 3. Database Migration Order
Migrations in `backend/src/main/resources/db/migration/` are strictly sequential (`V1`–`V9`):
1. `V1__baseline.sql`
2. `V2__phase2_retention_and_growth.sql`
3. `V3__phase3_operations_and_intelligence.sql`
4. `V4__phase4_delivery_otp_pod_and_ops.sql`
5. `V5__align_ai_extraction_logs.sql`
6. `V6__loyalty_and_rewards.sql`
7. `V7__promotional_offers.sql`
8. `V8__supplier_payments_and_purchase_tracking.sql`
9. `V9__backup_records.sql`

## 4. Backup & Recovery Limitations
- `/staff/backups` creates read-only JSON-in-ZIP snapshots (excluding user passwords, JWTs, and secrets) verified with `SHA-256` checksums.
- **Automated database restore and backup deletion are intentionally disabled** in this release. Full MySQL disaster recovery must follow the documented manual dump/restore runbooks (`scripts/backup-mysql.*`, `scripts/restore-mysql-test.*`).
- **Audit Log System (`audit_logs`)** was paused at its schema approval gate and is **not** included in this release.

## 5. Known Issues
- **Legacy Dashboard Tests (`src/tests/phaseHRedesign.test.tsx`):** `2` legacy assertions fail because they expect the pre-upgrade `DashboardPage` structure prior to the Business Overview Dashboard upgrade (`GET /api/reports/overview`). Not a runtime regression.
- **Live DB / Integration Tests:** `Phase6a2RealMySQLIntegrationTest` and `Phase6a3RealSpringIntegrationTest` require a live MySQL instance and were not executed in the offline sandbox.

## 6. Production Launch Gates
1. Execute staging deployment per [STAGING_DEPLOYMENT_CHECKLIST.md](file:///C:/Taza_Tokri/STAGING_DEPLOYMENT_CHECKLIST.md) and confirm Flyway `V1`–`V9` + Hibernate `validate` succeed on MySQL 8.4.
2. Complete all 24 items in [SMOKE_TEST_CHECKLIST.md](file:///C:/Taza_Tokri/SMOKE_TEST_CHECKLIST.md) on staging.
3. Verify Razorpay live/test webhook delivery and WhatsApp Cloud API credentials (if enabled) in staging.
