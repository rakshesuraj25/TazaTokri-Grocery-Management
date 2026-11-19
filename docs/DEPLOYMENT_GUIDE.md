# TazaTokri Production Deployment Guide

This guide details the steps to deploy the TazaTokri full-stack application using Docker Compose on a single Linux VPS (Ubuntu 22.04 / 24.04 LTS or Debian 12).

---

## 1. System Requirements & Prerequisites

### Minimum Hardware
- **CPU:** 2 vCPUs (x86_64 or ARM64)
- **RAM:** 4 GB RAM (with at least 2 GB swap enabled)
- **Disk:** 25 GB SSD or NVMe storage
- **OS:** Ubuntu 22.04 LTS / 24.04 LTS

### Required Software on Host
- **Docker Engine:** v24.0+ (`sudo apt-get install docker.io`)
- **Docker Compose:** v2.20+ (`sudo apt-get install docker-compose-plugin`)
- **Reverse Proxy with Automated HTTPS:** Caddy or Nginx with Certbot
- **Firewall (UFW):** Ports 22 (SSH), 80 (HTTP), 443 (HTTPS) open. **Do NOT open port 3306 or 8080 to the public internet.**

---

## 2. Pre-Deployment Configuration

### Step 2.1: Clone Repository & Create Dedicated Deploy Directory
```bash
git clone https://github.com/your-username/Taza_Tokri.git /opt/tazatokri
cd /opt/tazatokri
```

### Step 2.2: Configure Production Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
chmod 600 .env
```

Generate cryptographically secure passwords and edit `.env`:
```bash
# Generate DB App password:
openssl rand -base64 24

# Generate DB Root password:
openssl rand -base64 24

# Generate 32+ byte JWT secret:
openssl rand -base64 32
```

Edit `/opt/tazatokri/.env` with `nano` or `vim`:
```ini
DB_NAME=tazatokri
DB_APP_USER=tazatokri_app
DB_APP_PASSWORD=<INSERT_GENERATED_APP_PASSWORD>
DB_ROOT_PASSWORD=<INSERT_GENERATED_ROOT_PASSWORD>

JWT_SECRET=<INSERT_GENERATED_32_BYTE_JWT_SECRET>

BOOTSTRAP_OWNER_NAME="TazaTokri Store Owner"
BOOTSTRAP_OWNER_PHONE="9876543210"
BOOTSTRAP_OWNER_PASSWORD=<INSERT_STRONG_INITIAL_PASSWORD>

CORS_ALLOWED_ORIGINS=https://tazatokri.example.com
VITE_API_URL=
```

---

## 3. Reverse Proxy & SSL Setup

In production, user traffic should hit a reverse proxy on ports 80/443, terminating TLS and proxying requests to the Docker containers.

### Recommended Caddyfile (`/etc/caddy/Caddyfile`)
```caddy
tazatokri.example.com {
    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Proxy backend REST APIs and Actuator health
    handle /api/* {
        reverse_proxy localhost:8080
    }
    handle /actuator/health* {
        reverse_proxy localhost:8080
    }

    # Proxy frontend PWA static assets
    handle /* {
        reverse_proxy localhost:80
    }
}
```

---

## 4. Launching the Services

Run Docker Compose to build images and launch containers in detached mode:
```bash
docker compose pull mysql
docker compose up -d --build
```

### Verifying Container Health
```bash
docker compose ps
```
Expected output:
- `tazatokri-mysql`: `Up (healthy)` (internal port 3306 only)
- `tazatokri-backend`: `Up (healthy)` (port 8080 on localhost)
- `tazatokri-frontend`: `Up (healthy)` (port 80 on localhost)

### Inspecting Startup Logs
```bash
docker compose logs -f backend
```
Look for the verification message:
```text
Production security hardening verification passed successfully.
Flyway Community Edition 10.x.x by Redgate
Successfully validated 4 migrations (execution time 00:00.045s)
Started TazatokriBackendApplication in 4.2 seconds
```

---

## 5. Post-Deployment Verification Checklist

1. **Verify Database Health:**
   ```bash
   curl -I http://localhost:8080/actuator/health
   ```
   Must return `HTTP/1.1 200 OK` with status `UP`.
2. **Verify Public Catalog API:**
   ```bash
   curl http://localhost:8080/api/public/vegetables
   ```
   Returns active vegetable catalog with 36 items.
3. **Verify First Store Owner Bootstrap:**
   - Log into the web interface at `https://tazatokri.example.com/login` using the `BOOTSTRAP_OWNER_PHONE` and `BOOTSTRAP_OWNER_PASSWORD`.
   - Immediately change the owner password from the staff settings interface.
4. **Verify Upload Directory Permissions:**
   Ensure `/opt/tazatokri/data/private-uploads` is owned by UID 1001 (`tazatokri`).

---

## 6. Daily Maintenance & Automated Backups

A cron job should be installed on the host to create daily database dumps:
```bash
# Add to host crontab (crontab -e)
0 2 * * * cd /opt/tazatokri && ./scripts/backup-db.sh >> /var/log/tazatokri-backup.log 2>&1
```

To view logs across all services:
```bash
docker compose logs -n 100 -f
```
