# TazaTokri — Production Deployment Guide

## 1. Required Environment Variables

### Backend (`backend/application.properties` / Container Env)
| Variable | Required | Default / Example | Purpose |
|---|---|---|---|
| `DB_APP_PASSWORD` | Yes | Strong 24+ char secret | MySQL `tazatokri_app` runtime password |
| `DB_PASSWORD` | Yes (Flyway) | Strong secret | Flyway migration user password |
| `JWT_SECRET` | Yes | 64+ char random hex | HMAC-SHA signing key for JWT tokens |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://shop.tazatokri.in` | Comma-separated allowed frontend origins |
| `APP_VERSION` | Recommended | `0.4.0` | Reported in `/api/ops/health` |
| `STORAGE_PROVIDER` | Optional | `LOCAL` or `S3_R2` | Proof-of-delivery photo storage backend |
| `STORAGE_LOCAL_DIR` | Optional | `/app/data/private-uploads` | Private directory for POD photos |
| `DELIVERY_OTP_TTL_MINUTES` | Optional | `30` | Delivery OTP expiration window |
| `DELIVERY_OTP_MAX_ATTEMPTS` | Optional | `5` | Max failed OTP attempts before lock |
| `DELIVERY_POD_REQUIRE_PHOTO` | Optional | `false` | Require photo upload before completion |
| `SENTRY_DSN` | Optional | `https://...@sentry.io/...` | Backend error reporting DSN |
| `SENTRY_ENVIRONMENT` | Optional | `production` | Environment tag for Sentry & Ops Health |
| `RAZORPAY_KEY_ID` / `KEY_SECRET` / `WEBHOOK_SECRET` | Optional | Live keys | Online UPI/card checkout |
| `WHATSAPP_ENABLED` / `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Optional | `false` | Official WhatsApp Cloud API |
| `GEMINI_ENABLED` / `GEMINI_API_KEY` | Optional | `false` | Gemini AI invoice & Quick Sale draft scanning |

### Frontend Build Args (`frontend/.env.production` / Docker `--build-arg`)
- `VITE_API_URL=https://api.tazatokri.in` (HTTPS mandatory in production)
- `VITE_ENABLE_MSW=false`
- `VITE_SENTRY_DSN=` (optional)
- `VITE_SENTRY_ENVIRONMENT=production`

---

## 2. Deployment Steps

1. **Pre-Deployment Backup:** Run `./scripts/backup-mysql.sh` (or `backup-mysql.ps1`) and verify the SHA-256 checksum before applying any release.
2. **Build & Verify Images:**
   - Backend: `docker build -t tazatokri-backend:0.4.0 ./backend`
   - Frontend: `docker build --build-arg VITE_API_URL=https://api.tazatokri.in -t tazatokri-frontend:0.4.0 ./frontend`
3. **Database Migrations:** Flyway executes `V1__...` through `V4__phase4_delivery_otp_pod_and_ops.sql` automatically on startup (`spring.jpa.hibernate.ddl-auto=validate` ensures schema safety).
4. **Health Verification:**
   - Check `GET https://api.tazatokri.in/actuator/health/liveness` -> `{"status":"UP"}`
   - Check `GET https://api.tazatokri.in/actuator/health/readiness` -> `{"status":"UP"}`
   - Log in as Owner and verify `GET /api/ops/health` shows `databaseConnected: true`.

---

## 3. Safe Rollback Procedure

1. Stop the newly deployed backend/frontend containers.
2. Re-deploy the previous known-good Docker image tag (e.g., `0.3.0`).
3. **Do NOT drop tables on live production.** If a schema rollback is ever required due to a corrupt deployment, restore the pre-deployment MySQL backup into a staging/recovery database first, validate row counts, and switch traffic cleanly per [`DATABASE_BACKUP_AND_RESTORE.md`](./DATABASE_BACKUP_AND_RESTORE.md).
