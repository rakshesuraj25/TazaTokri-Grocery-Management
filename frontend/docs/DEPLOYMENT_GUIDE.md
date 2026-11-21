# TazaTokri — Production Deployment Guide (Phase 5)

**Application:** TazaTokri Grocery & Inventory Management Platform  
**Target Environments:** Self-hosted Linux VPS, AWS EC2, GCP Compute Engine, Docker Swarm / Kubernetes  

---

## 1. System Requirements

- **Operating System:** Linux (Ubuntu 22.04 LTS / Debian 12 / Alpine) or Windows Server
- **Runtime:** Docker 24.0+ & Docker Compose v2.20+
- **Hardware Minimum:** 2 vCPU, 4 GB RAM, 20 GB SSD storage
- **Recommended Production:** 4 vCPU, 8 GB RAM, 50 GB NVMe SSD storage

---

## 2. Monorepo Container Architecture

```text
               Internet (Clients / Browsers / Mobile PWA)
                                │
                                ▼
               ┌─────────────────────────────────┐
               │  Reverse Proxy / Ingress (80/443)│
               └────────────────┬────────────────┘
                                │
         ┌──────────────────────┴──────────────────────┐
         ▼                                             ▼
┌──────────────────┐                         ┌──────────────────┐
│ tazatokri-frontend│                         │ tazatokri-backend │
│ Nginx 1.27 Alpine│                         │ Java 21 Alpine   │
│ Port 80 (SPA)    │                         │ Port 8080 (REST) │
└──────────────────┘                         └────────┬─────────┘
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │ tazatokri-mysql  │
                                             │ MySQL 8.4 Server │
                                             │ Port 3306 (DB)   │
                                             └──────────────────┘
```

---

## 3. Environment Variables Reference

| Variable | Description | Default / Example | Required in Production |
|---|---|---|---|
| `DB_APP_PASSWORD` | Password for MySQL `tazatokri_app` user | *(set in `.env`)* | **YES** |
| `DB_PASSWORD` | Password for MySQL `root` / Flyway user | *(set in `.env`)* | **YES** |
| `JWT_SECRET` | 256-bit secret key for HMAC SHA-256 JWT signing | *Must be >= 32 chars* | **YES** |
| `CORS_ALLOWED_ORIGINS` | Permitted web origins (comma-separated) | `https://shop.tazatokri.com` | **YES** |
| `BOOTSTRAP_OWNER_PHONE`| Phone number for initial OWNER account | `9999999999` | Optional |
| `BOOTSTRAP_OWNER_PASSWORD`| Initial password for OWNER bootstrap | *(set in `.env`)* | **YES (prod)** |
| `RAZORPAY_KEY_ID` | Razorpay Merchant Key ID | `rzp_live_...` | For Online Payments |
| `RAZORPAY_KEY_SECRET` | Razorpay Merchant Secret Key | `...` | For Online Payments |
| `RAZORPAY_WEBHOOK_SECRET` | Secret for verifying Razorpay webhooks | `...` | For Online Payments |
| `WHATSAPP_ENABLED` | Toggle WhatsApp Cloud API notifications | `true` / `false` | Optional |
| `WHATSAPP_ACCESS_TOKEN` | Meta Graph API access token | `EAA...` | If WhatsApp enabled |
| `GEMINI_ENABLED` | Toggle AI assistant (Invoice & POS scanner) | `true` / `false` | Optional |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` | If Gemini enabled |
| `SENTRY_DSN` | Sentry Error Reporting DSN | `https://...@sentry.io/...` | Optional |
| `STORAGE_PROVIDER` | Proof of Delivery storage mode | `LOCAL` or `S3` | Optional (`LOCAL`) |

---

## 4. Launching with Docker Compose

1. **Clone repository and configure `.env`:**
   ```bash
   cp .env.example .env
   # Edit .env with your production credentials
   ```

2. **Build and launch containers:**
   ```bash
   docker compose up -d --build
   ```

3. **Verify running containers and health checks:**
   ```bash
   docker compose ps
   ```

   Expected output:
   ```text
   NAME                 IMAGE               STATUS                    PORTS
   tazatokri-mysql      mysql:8.4           Up (healthy)              0.0.0.0:3306->3306/tcp
   tazatokri-backend    tazatokri-backend   Up (healthy)              0.0.0.0:8080->8080/tcp
   tazatokri-frontend   tazatokri-frontend  Up (healthy)              0.0.0.0:5173->80/tcp
   ```

4. **Verify Application Health:**
   ```bash
   curl http://localhost:8080/actuator/health
   # Response: {"status":"UP"}
   ```
