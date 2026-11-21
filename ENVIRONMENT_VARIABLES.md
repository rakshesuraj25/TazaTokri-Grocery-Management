# TazaTokri — Environment Variables Reference

> **Security Note:** Never commit actual values, passwords, tokens, or private keys. Set all required secrets via your host/container secret manager or protected `.env` file outside version control.

## 1. Required in Production / Staging (`spring.profiles.active=prod`)

| Variable Name | Purpose | Notes |
| --- | --- | --- |
| `DB_NAME` | MySQL database name | Default in Compose: `tazatokri` |
| `DB_APP_USER` | Application MySQL user | Default in Compose: `tazatokri_app` |
| `DB_APP_PASSWORD` | Application MySQL password | **Required** (no fallback in `prod`) |
| `DB_ROOT_PASSWORD` | MySQL root / Flyway migration password | **Required** (no fallback in `prod`) |
| `JWT_SECRET` | HMAC signing secret for JWT tokens | **Required** (no fallback in `prod`) |
| `BOOTSTRAP_OWNER_NAME` | Initial OWNER display name | Default: `TazaTokri Owner` |
| `BOOTSTRAP_OWNER_PHONE` | Initial OWNER login phone | Default: `9999999999` |
| `BOOTSTRAP_OWNER_PASSWORD` | Initial OWNER bootstrap password | **Required** (no fallback in `prod`) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins | **Required** in `prod` (e.g. `https://app.example.com`) |

## 2. Database & Runtime

| Variable Name | Purpose | Default |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | Active Spring profile | `prod` in Docker Compose |
| `SPRING_DATASOURCE_URL` | JDBC MySQL connection string | `jdbc:mysql://mysql:3306/tazatokri?serverTimezone=Asia/Kolkata&allowPublicKeyRetrieval=true&useSSL=false` |
| `SPRING_DATASOURCE_USERNAME` | JDBC username | `tazatokri_app` |
| `SPRING_FLYWAY_USER` | Flyway migration user | `root` |
| `TZ` | Container timezone | `Asia/Kolkata` |
| `APP_VERSION` | Application version tag | `0.4.0` |

## 3. Storage & Backups

| Variable Name | Purpose | Default / Staging Path |
| --- | --- | --- |
| `STORAGE_PROVIDER` | Private upload storage backend (`LOCAL` / S3) | `LOCAL` |
| `STORAGE_LOCAL_DIR` | Private upload directory (POD, etc.) | `/app/data/private-uploads` |
| `APP_BACKUP_DIR` | Private writable directory for ZIP backups | `/app/data/backups` |
| `BACKUP_STATUS_FILE` | Optional external backup status JSON path | `/app/data/backup-status/backup-status.json` |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Optional S3-compatible object storage | Empty unless `STORAGE_PROVIDER=S3` |

## 4. Payments (Razorpay)

| Variable Name | Purpose | Default |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID | Empty (disables online payments if unset) |
| `RAZORPAY_KEY_SECRET` | Razorpay API Key Secret | Empty |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook HMAC secret | Empty |

## 5. Optional Integrations & Observability

| Variable Name | Purpose | Default |
| --- | --- | --- |
| `WHATSAPP_ENABLED` | Enable WhatsApp Cloud API notifications | `false` (uses manual fallback) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Phone Number ID | Empty |
| `WHATSAPP_ACCESS_TOKEN` | Meta Graph API Bearer Token | Empty |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID | Empty |
| `WHATSAPP_API_VERSION` | Graph API version | `v21.0` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook verification token | Empty |
| `WHATSAPP_SHOP_SUPPORT_PHONE` | Shop support phone for customer templates | `9999999999` |
| `GEMINI_ENABLED` | Enable AI invoice/list draft assistant | `false` |
| `GEMINI_API_KEY` | Gemini API key | Empty |
| `GEMINI_MODEL` | Gemini model identifier | `gemini-4-hydrogen` |
| `GEMINI_MAX_UPLOAD_BYTES` | Max upload size for AI draft extraction | `5242880` |
| `DELIVERY_OTP_TTL_MINUTES` | Delivery OTP expiration window | `30` |
| `DELIVERY_OTP_MAX_ATTEMPTS` | Max OTP verification attempts | `5` |
| `DELIVERY_POD_MAX_UPLOAD_BYTES` | Max POD photo upload size | `5242880` |
| `DELIVERY_POD_REQUIRE_PHOTO` | Require photo proof on delivery | `false` |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` | Optional Sentry error/perf tracking | Disabled if DSN empty |

## 6. Frontend Build-Time Variables

| Variable Name | Purpose | Default |
| --- | --- | --- |
| `VITE_API_URL` | Optional API base URL (empty when proxied via Nginx) | `""` |
