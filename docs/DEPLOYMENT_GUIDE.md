# TazaTokri Production Deployment Guide

This guide details the safe production deployment process for TazaTokri using Docker Compose on a single Linux VPS (Ubuntu 22.04 / 24.04 LTS or Debian 12).

---

## 1. System Requirements & Prerequisites

### Minimum Hardware
- **CPU:** 2 vCPUs (x86_64 or ARM64)
- **RAM:** 4 GB RAM (with at least 2 GB swap enabled)
- **Disk:** 25 GB SSD or NVMe storage
- **OS:** Ubuntu 22.04 LTS / 24.04 LTS

### Required Software on Host
- **Docker Engine:** v24.0+
- **Docker Compose:** v2.20+ (`docker compose`)
- **Bash, OpenSSL, gzip, sha256sum, mysqldump** (for host backup scripts if invoked outside containers)
- **Firewall (UFW):** Open only ports `22` (SSH), `80` (HTTP redirect + ACME challenge), and `443` (HTTPS). **Do NOT expose port `3306` or `8080` to the public internet.** In `docker-compose.yml`, both `mysql` (`3306`) and `backend` (`8080`) use `expose:` on the internal `tazatokri-internal` bridge network only.

---

## 2. Pre-Deployment Configuration

### Step 2.1: Clone Repository & Configure `.env`
```bash
git clone <your-repo-url> /opt/tazatokri
cd /opt/tazatokri
cp .env.example .env
chmod 600 .env
```

Generate strong secrets (never commit `.env` to Git):
```bash
openssl rand -base64 24   # DB_APP_PASSWORD / DB_ROOT_PASSWORD
openssl rand -base64 32   # JWT_SECRET (min 32 bytes for HMAC-SHA256)
openssl rand -base64 32   # BACKUP_ENCRYPTION_PASSPHRASE (store independently offsite!)
```

Set required variables in `/opt/tazatokri/.env` (see `.env.example` for all optional integrations):
- `DB_NAME=tazatokri`, `DB_APP_USER=tazatokri_app`, `DB_APP_PASSWORD`, `DB_ROOT_PASSWORD`
- `JWT_SECRET`
- `BOOTSTRAP_OWNER_NAME`, `BOOTSTRAP_OWNER_PHONE`, `BOOTSTRAP_OWNER_PASSWORD`
- `CORS_ALLOWED_ORIGINS=https://your-production-domain.com` (never `*`)
- `VITE_API_URL=` (empty for same-origin `/api/` reverse proxying)
- `BACKUP_ENCRYPTION_PASSPHRASE` (required by `scripts/backup-mysql.sh` in production)
- `APP_VERSION=0.4.0` (optional default; may also be passed per deployment)

### Step 2.2: Host Storage & Permissions Alignment
`docker-compose.yml` isolates MySQL (`mysql_data` named volume) while bind-mounting:
- `./backend/data/private-uploads:/app/data/private-uploads` (written by `backend` UID `1001`)
- `./backend/data/backup-status:/app/data/backup-status:ro` (read-only metadata `backup-status.json` for `GET /api/ops/health`; encrypted archives in `./backend/data/backups/` are **never** mounted into `backend`)

Create the host directories with restrictive permissions before first startup (never use `chmod 777`):
```bash
mkdir -p /opt/tazatokri/backend/data/private-uploads \
         /opt/tazatokri/backend/data/backup-status \
         /opt/tazatokri/backend/data/backups \
         /opt/tazatokri/infra/certs \
         /opt/tazatokri/infra/certbot/www
sudo chown -R 1001:1001 /opt/tazatokri/backend/data/private-uploads
chmod 750 /opt/tazatokri/backend/data/private-uploads
chmod 755 /opt/tazatokri/backend/data/backup-status /opt/tazatokri/infra/certs /opt/tazatokri/infra/certbot/www
chmod 700 /opt/tazatokri/backend/data/backups
```

> **Legacy Named Volume Migration Note (If Upgrading an Existing Host):** If an older host already stored files in the `backend_uploads` Docker named volume, copy them manually into `./backend/data/private-uploads` before starting the updated Compose file (`docker run --rm -v tazatokri_backend_uploads:/src:ro -v /opt/tazatokri/backend/data/private-uploads:/dst alpine sh -c 'cp -a /src/. /dst/ && chown -R 1001:1001 /dst'`). Do **not** delete `mysql_data`.

### Step 2.3: Edge Reverse Proxy & Initial TLS Issuance (`scripts/tls-bootstrap.sh`)
`docker-compose.yml` uses `frontend` Nginx (`infra/nginx/default.conf`) as the single edge reverse proxy on ports `80` and `443`. Nginx requires `fullchain.pem` and `privkey.pem` at startup, so issue the initial certificate **before** starting `frontend` (port `80` must be free and DNS `A` record must already resolve to the VPS):
```bash
cd /opt/tazatokri
DOMAIN=your-production-domain.com CERTBOT_EMAIL=ops@your-production-domain.com bash scripts/tls-bootstrap.sh
```
This runs Certbot standalone HTTP-01, dereference-copies (`cp -L`) `fullchain.pem` (`644`) and `privkey.pem` (`600`) into `./infra/certs/`, and prepares `./infra/certbot/www` for future zero-downtime webroot renewals.

### Step 2.4: Automatic TLS Renewal (`scripts/tls-renew.sh`)
Schedule twice-daily renewal via host cron (`certbot renew --webroot -w /opt/tazatokri/infra/certbot/www`), preserving existing certificates on failure and reloading Nginx only after `nginx -t` passes:
```cron
15 3,15 * * * cd /opt/tazatokri && DOMAIN=your-production-domain.com bash scripts/tls-renew.sh >> /var/log/tazatokri-tls-renew.log 2>&1
```

---

## 3. Versioned Docker Image Strategy

`docker-compose.yml` assigns explicit versioned image tags to both application services:
- **Backend image:** `tazatokri-backend:${APP_VERSION:-0.4.0}`
- **Frontend image:** `tazatokri-frontend:${APP_VERSION:-0.4.0}`
- **Default version:** `0.4.0` (never use `latest`).

### Why Versioned Images Are Retained
Building a new version (e.g., `0.5.0`) creates new local tags without overwriting or pruning the previous version (`0.4.0`). This enables fast application-only rollback (`--no-build`) without rebuilding from source during an incident.

### Manual Build & Deploy Commands
```bash
# Build a specific version
APP_VERSION=0.5.0 docker compose build backend frontend

# Deploy that specific version (preserving volumes/data)
APP_VERSION=0.5.0 docker compose up -d mysql backend frontend
```

---

## 4. Safe Production Deployment (`scripts/deploy-prod.sh`)

### Fresh Bootstrap (Empty VPS Only)
Use `INITIAL_BOOTSTRAP=true` **only** when neither a `mysql` container nor a `mysql_data` volume exists yet (the script aborts if any existing container or `mysql_data` volume is detected):
```bash
cd /opt/tazatokri
INITIAL_BOOTSTRAP=true APP_VERSION=0.4.0 bash scripts/deploy-prod.sh
```
After `mysql`, `backend`, and `frontend` pass health checks, `deploy-prod.sh` automatically takes and verifies the initial encrypted baseline backup.

### Subsequent Deployments (Existing Database)
For all subsequent releases, run without `INITIAL_BOOTSTRAP`:
```bash
cd /opt/tazatokri
APP_VERSION=0.5.0 bash scripts/deploy-prod.sh
```
*(If `APP_VERSION` is omitted, it uses the value from `.env` or defaults to `0.4.0`.)*

### Automated Deployment Flow
1. **Preflight:** Verifies `docker`, `docker compose`, `docker-compose.yml`, `.env` (never printed), `infra/certs/{fullchain,privkey}.pem`, `scripts/backup-mysql.sh`, and runs `docker compose config -q`.
2. **Mandatory Encrypted Backup Gate:** For existing databases, invokes `scripts/backup-mysql.sh` (`BACKUP_MODE=docker`, `BACKUP_ENV=production`) executing `mysqldump` inside the internal `mysql` container **before** any build or container change. If the backup fails, deployment aborts immediately.
3. **Versioned Build:** Builds `tazatokri-backend:${APP_VERSION}` and `tazatokri-frontend:${APP_VERSION}` without pruning prior versions.
4. **Deploy:** Runs `docker compose up -d mysql backend frontend` (never `down`, `-v`, or `prune`). **Note:** Spring Boot executes Flyway migrations (`V1`–`V4`+) automatically on backend startup; application rollback does not reverse database migrations.
5. **Bounded Health Verification:**
   - Polls backend readiness inside the `backend` container (`http://localhost:8080/actuator/health/readiness`) up to `HEALTH_MAX_ATTEMPTS` (default `24`) every `HEALTH_POLL_SECONDS` (default `5`s), requiring `"UP"`.
   - Polls frontend health inside the `frontend` container (`http://localhost:80/nginx-health`) up to `24` attempts every `5`s, requiring `ok`.
6. **Post-Bootstrap Baseline Backup / Summary:** On `INITIAL_BOOTSTRAP=true`, runs the baseline encrypted MySQL backup immediately after readiness passes. Exits non-zero if any step fails.

---

## 5. Post-Deployment Verification

Because `backend` (`8080`) is internal-only and `/nginx-health` is localhost-restricted, verify service health through containers or the HTTPS edge:

```bash
# Container status & health
docker compose ps

# Internal backend readiness (verifies MySQL connectivity)
docker compose exec -T backend wget -qO- http://localhost:8080/actuator/health/readiness

# Internal frontend Nginx health
docker compose exec -T frontend wget -qO- http://localhost:80/nginx-health

# Public catalog via HTTPS edge
curl -fsS https://your-production-domain.com/api/public/vegetables
```

---

## 6. Daily Backups, Offsite Replication & Logs

- **Automated Daily MySQL Backups:** Schedule `scripts/backup-mysql.sh` with `BACKUP_MODE=docker`, `BACKUP_ENV=production`, and `BACKUP_STATUS_FILE=/opt/tazatokri/backend/data/backup-status/backup-status.json`. Store `BACKUP_ENCRYPTION_PASSPHRASE` independently offsite.
- **Proof-of-Delivery Uploads:** Schedule `scripts/backup-uploads.sh` (`BACKUP_ENV=production`, `BACKUP_ENCRYPTION_PASSPHRASE` required) to archive `./backend/data/private-uploads` with `14`-day retention.
- **Offsite Replication:** Sync `./backend/data/backups/` (`.sql.gz.enc`, `.tar.gz.enc`, and `.sha256` files) to offsite encrypted object storage (e.g., `rclone sync` / S3) after each daily run.
- **Isolated Restore Verification:** Periodically test backups on the VPS using `RESTORE_MODE=docker TEST_DB_NAME=tazatokri_restore_verify bash scripts/restore-mysql-test.sh <artifact.sql.gz.enc>`.
- **Logs:** Docker Compose caps container logs with `json-file` (`max-size: 10m`, `max-file: 5`). Inspect with:
  ```bash
  docker compose logs -n 100 -f
  ```
