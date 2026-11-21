# TazaTokri Production Environment Variables Reference

This document provides a comprehensive specification of all environment variables supported and enforced by TazaTokri in production mode (`SPRING_PROFILES_ACTIVE=prod`).

---

## 1. Required Production Variables (Fail-Fast at Startup)

The backend **refuses to start** (`IllegalStateException`) if any of these variables are missing, set to insecure development defaults, or below minimum security thresholds.

| Variable Name | Required | Min Length / Rules | Description | Example / Recommended Generation |
|---|---|---|---|---|
| `DB_APP_PASSWORD` | **YES** | Strong password | Password for the MySQL application database user `tazatokri_app`. Cannot be default `choose-a-long-password`. | Generate via: `openssl rand -base64 24` |
| `DB_ROOT_PASSWORD` | **YES** | Strong password | Root administrative password for the MySQL container / database server. Cannot be default `root`. | Generate via: `openssl rand -base64 24` |
| `JWT_SECRET` | **YES** | >= 32 characters (256 bits) | Secret key used to sign and verify customer/staff HMAC-SHA256 JWT tokens. Cannot be default dev secret. | Generate via: `openssl rand -base64 32` |
| `BOOTSTRAP_OWNER_PASSWORD`| **YES**| Strong password | Password assigned to initial store owner account if no owner exists upon first database startup. Cannot be `Owner@123`. | e.g. `K9#m$P2x!vL8@qW5` |
| `CORS_ALLOWED_ORIGINS` | **YES** | Valid origin URL | Restrictive comma-separated list of allowed web origins allowed to make browser API requests. | `https://tazatokri.com,https://www.tazatokri.com` |

---

## 2. Infrastructure & Database Variables

| Variable Name | Required | Default in Docker Compose | Description |
|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Recommended | `prod` | Active Spring Boot profiles. Set to `prod` in production. |
| `SPRING_DATASOURCE_URL` | Optional | `jdbc:mysql://mysql:3306/tazatokri?serverTimezone=Asia/Kolkata...` | Full JDBC database connection string. |
| `DB_NAME` | Optional | `tazatokri` | MySQL database name. |
| `DB_APP_USER` | Optional | `tazatokri_app` | Restricted MySQL user used by Spring Boot JPA. |
| `SPRING_FLYWAY_USER` | Optional | `root` | Database user used by Flyway schema migration runner. |
| `TZ` | Recommended | `Asia/Kolkata` | Container and JVM timezone. Enforces IST timestamp handling. |

---

## 3. Business Rules & Store Settings (Preserved Core Rules)

| Variable Name | Default Value | Description |
|---|---|---|
| `app.delivery.min-order` | `150` | Minimum order amount (in ₹) required to place a delivery order. |
| `app.delivery.fee` | `30` | Standard delivery fee (in ₹). |
| `app.delivery.free-above` | `300` | Minimum order subtotal (in ₹) for free delivery. |
| `app.delivery.cutoff-time` | `18:00` | Daily order cutoff time in IST (orders placed after 18:00 deliver next day). |
| `app.delivery.pincodes` | `411026,411039` | Serviceable postal PIN codes for customer delivery addresses. |
| `app.order.payment-hold-minutes` | `15` | Window (in minutes) an online UPI/card order is held before stock release. |
| `app.order.max-over-percent` | `20` | Allowed percentage an order's billed amount may exceed original cart during packing adjustments. |
| `app.pricing.margin-percent` | `20` | Target gross margin percentage used in retail price suggestions. |
| `app.pricing.wastage-percent` | `5` | Expected vegetable wastage percentage used in pricing formulas. |
| `app.pricing.lookback-days` | `3` | Lookback period (days) used to compute average mandi purchase costs. |

---

## 4. Optional Third-Party Service Credentials

These services are safely bypassed/disabled if credentials are not provided. The core shop, catalog, cart, COD checkout, POS, and inventory remain fully functional.

| Variable Name | Service | Default Value | Behavior When Unset |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | Razorpay Payments | *(empty)* | Online payments disabled; COD available. |
| `RAZORPAY_KEY_SECRET` | Razorpay Payments | *(empty)* | Must be set together with `RAZORPAY_KEY_ID` & `RAZORPAY_WEBHOOK_SECRET` in `prod`. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhooks | *(empty)* | Must be set together with `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` in `prod`. |
| `WHATSAPP_ENABLED` | WhatsApp Cloud API | `false` | When `false`, order notifications write `SKIPPED` log. |
| `WHATSAPP_PHONE_NUMBER_ID`| WhatsApp Cloud API | *(empty)* | Required if `WHATSAPP_ENABLED=true`. |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API | *(empty)* | Permanent or system-user Meta Graph API token. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | WhatsApp Cloud API | *(empty)* | Secret verify token configured in Meta webhook setup. |
| `GEMINI_ENABLED` | Google Gemini AI | `false` | When `false`, invoice and list parsing endpoints return HTTP 400. |
| `GEMINI_API_KEY` | Google Gemini AI | *(empty)* | Google Cloud API key for Gemini 1.5/2.0 multimodal vision. |

---

## 5. Storage, Monitoring & Logging Variables

| Variable Name | Default Value | Description |
|---|---|---|
| `STORAGE_PROVIDER` | `LOCAL` | Storage backend for delivery proof photos (`LOCAL` or `S3`). |
| `STORAGE_LOCAL_DIR` | `/app/data/private-uploads` | Directory path where delivery proof images are saved. |
| `BACKUP_STATUS_FILE` | `/app/data/backups/backup-status.json` | Path where automated backup status records are written. |
| `SENTRY_DSN` | *(empty)* | Sentry DSN for frontend and backend error telemetry. Disabled if empty. |
| `SENTRY_ENVIRONMENT` | `production` | Tag assigned to Sentry exception events. |
| `SENTRY_TRACES_SAMPLE_RATE`| `0.1` | Performance transaction sampling rate (10%). |
| `VITE_API_URL` | *(empty)* | Frontend API base URL. Leave empty for same-origin reverse-proxy deployment. |

---

## 6. Secure Production `.env` Template

Create a file named `.env` in the project root with real secrets before launching Docker Compose:

```bash
# --- Mandatory Database Secrets ---
DB_NAME=tazatokri
DB_APP_USER=tazatokri_app
DB_APP_PASSWORD=USE_A_STRONG_RANDOM_PASSWORD_HERE
DB_ROOT_PASSWORD=USE_A_STRONG_ROOT_PASSWORD_HERE

# --- Mandatory Security Secrets ---
JWT_SECRET=USE_A_RANDOM_STRING_AT_LEAST_32_CHARACTERS_LONG_HERE
BOOTSTRAP_OWNER_NAME="Store Owner"
BOOTSTRAP_OWNER_PHONE=9999999999
BOOTSTRAP_OWNER_PASSWORD=USE_A_STRONG_OWNER_PASSWORD_HERE
CORS_ALLOWED_ORIGINS=https://tazatokri.example.com

# --- Frontend Base URL (Leave empty for reverse proxy) ---
VITE_API_URL=

# --- Optional Services ---
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
WHATSAPP_ENABLED=false
GEMINI_ENABLED=false
```

---

## 7. Local Development Setup (No Hardcoded Fallback Secrets)

TazaTokri does **not** ship fallback passwords or JWT signing secrets in `application-dev.properties`.

1. Copy `.env.example` to `.env` in the repository root (`.env` is gitignored):
   ```bash
   cp .env.example .env
   ```
2. Replace all `PLACEHOLDER_*` values in `.env` with your local development credentials (`DB_APP_PASSWORD`, `DB_PASSWORD`, `JWT_SECRET` `>= 32` chars, and `BOOTSTRAP_OWNER_PASSWORD` if no owner exists yet).
3. `application-dev.properties` imports `optional:file:.env[.properties],optional:file:../.env[.properties]` automatically, or you can export them as environment variables before running `./mvnw spring-boot:run`.

---

## 8. Secret Rotation & Git Exposure Response

### Routine / Incident Secret Rotation
- **`JWT_SECRET`:** Generate a new `>= 32`-byte secret (`openssl rand -base64 32`), update `.env`, and restart `backend` (immediately invalidates all active JWTs).
- **`DB_APP_PASSWORD` / `DB_ROOT_PASSWORD`:** Update the MySQL user password first, then update `.env` and recreate `mysql`/`backend`.
- **`RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`:** Rotate in Razorpay Dashboard, update `.env`, and restart `backend`.
- **`BACKUP_ENCRYPTION_PASSPHRASE`:** Update `.env` and offsite vault, then run a fresh `scripts/backup-mysql.sh` + `scripts/backup-uploads.sh`.

### If a Secret Was Ever Committed to Git / GitHub
1. **Treat the secret as compromised immediately.** Removing it in a new commit does **not** remove it from Git history.
2. **Rotate/revoke** the exposed credential first (database passwords, JWT secret, API keys, passphrases).
3. If an external private key or live credential was pushed to a shared/public repository, follow GitHub's history-cleanup procedure (`git filter-repo` / BFG Repo-Cleaner) with team coordination after rotation.
