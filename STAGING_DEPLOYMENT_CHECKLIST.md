# TazaTokri — Staging Deployment Checklist

## 1. Pre-Deployment Prerequisites
- [ ] Target host has Docker Engine & Docker Compose v2+ installed.
- [ ] All required production/staging variables in [ENVIRONMENT_VARIABLES.md](file:///C:/Taza_Tokri/ENVIRONMENT_VARIABLES.md) are populated in the host environment or secret store (no default secrets).
- [ ] `CORS_ALLOWED_ORIGINS` matches the exact staging HTTPS/HTTP origin.
- [ ] Writable host directories exist for persistent bind mounts:
  - `./backend/data/private-uploads` → `/app/data/private-uploads`
  - `./backend/data/backups` → `/app/data/backups`
  - `./backend/data/backup-status` → `/app/data/backup-status`
- [ ] Take a pre-deployment MySQL dump before applying new migrations on an existing staging database.

## 2. Migration Order Verification (`V1`–`V9`)
Flyway (`spring.flyway.enabled=true`) executes migrations in strict version order on backend startup:
1. `V1__baseline.sql`
2. `V2__phase2_retention_and_growth.sql`
3. `V3__phase3_operations_and_intelligence.sql`
4. `V4__phase4_delivery_otp_pod_and_ops.sql`
5. `V5__align_ai_extraction_logs.sql`
6. `V6__loyalty_and_rewards.sql`
7. `V7__promotional_offers.sql`
8. `V8__supplier_payments_and_purchase_tracking.sql`
9. `V9__backup_records.sql`

- [ ] Confirm `spring.jpa.hibernate.ddl-auto=validate` passes after Flyway completes.

## 3. Build & Startup Steps
1. Build images: `docker compose build`
2. Start database and wait for healthy status: `docker compose up -d mysql`
3. Start backend & frontend services: `docker compose up -d backend frontend`
4. Verify backend health check: `GET /actuator/health` returns `{"status":"UP"}` (details hidden in `prod` profile).
5. Verify frontend loads cleanly and `/api/public/catalog` and `/api/public/store-settings` respond `200 OK`.

## 4. Post-Deploy Verification
- [ ] Execute all 24 scenarios in [SMOKE_TEST_CHECKLIST.md](file:///C:/Taza_Tokri/SMOKE_TEST_CHECKLIST.md).
- [ ] Verify backup creation in `/staff/backups` writes a verified `.zip` into `/app/data/backups` and download succeeds for `OWNER`.

## 5. Rollback Considerations
- **Application rollback:** Re-deploy previous `APP_VERSION` image tag via `scripts/rollback-prod.sh` (or `docker compose up -d`).
- **Database rollback:** Flyway does not auto-downgrade schema migrations (`V1`–`V9` are additive). If a schema rollback is required, restore the pre-deployment MySQL dump taken in Step 1.
