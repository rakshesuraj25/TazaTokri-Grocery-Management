# TazaTokri Production Operations Guide

This document defines steady-state production operations, backup scheduling, business continuity procedures, performance baselines, and the minimal operations dashboard for TazaTokri.

For initial VPS setup and deployments, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). For application-only rollbacks, see [ROLLBACK_PLAN.md](ROLLBACK_PLAN.md).

---

## 1. Operational Backup Schedule

All automated backups run on the Linux VPS host via cron/systemd timers using the verified scripts in `scripts/`:

| Job | Schedule (IST) | Command / Script | Target / Retention |
|---|---|---|---|
| **MySQL Encrypted Backup** | Daily `02:00` | `BACKUP_MODE=docker BACKUP_ENV=production BACKUP_STATUS_FILE=/opt/tazatokri/backend/data/backup-status/backup-status.json bash /opt/tazatokri/scripts/backup-mysql.sh` | `./backend/data/backups/tazatokri_backup_*.sql.gz.enc` (`14` days local) |
| **POD Uploads Encrypted Backup** | Daily `02:15` | `BACKUP_ENV=production bash /opt/tazatokri/scripts/backup-uploads.sh` | `./backend/data/backups/uploads/tazatokri_uploads_*.tar.gz.enc` (`14` days local) |
| **Offsite Replication** | Daily `02:30` | `rclone sync /opt/tazatokri/backend/data/backups <remote>:tazatokri-backups` | `30–90` days in S3-compatible / object storage |
| **Isolated Restore Drill** | Monthly (1st Sunday) | `RESTORE_MODE=docker TEST_DB_NAME=tazatokri_restore_verify SOURCE_DB=tazatokri bash /opt/tazatokri/scripts/restore-mysql-test.sh <latest.sql.gz.enc>` | Isolated schema only (never `tazatokri` or `tazatokri_prod`) |

- **Passphrase Escrow:** `BACKUP_ENCRYPTION_PASSPHRASE` must be stored in an independent offsite secrets vault (separate from the VPS).
- **RPO / RTO Targets (Theoretical until live VPS drill passes):** Target `RPO <= 24 hours`, Target `RTO <= 2 hours`.

---

## 2. Minimal Production Operations Dashboard

Reuse existing built-in endpoints and host checks rather than deploying heavy enterprise dashboards:

| Metric | Source | Access |
|---|---|---|
| **Website Uptime & HTTPS / TLS Expiry** | External monitor polling `https://<domain>/actuator/health/readiness` | External (UptimeRobot / Better Stack) |
| **Backend & MySQL Health, App Version, Last Backup** | `GET /api/ops/health` (`status`, `databaseConnected`, `applicationVersion`, `lastBackup`) | `OWNER` / `STAFF` JWT |
| **Container & Nginx Health** | `docker compose ps`, `docker compose exec -T frontend wget -qO- http://localhost:80/nginx-health` | Host SSH |
| **CPU / RAM / Disk Usage** | Host cron / `df -h`, `free -h`, `docker stats --no-stream` | Host SSH / cron alert |
| **Application & Payment Errors / Failed Jobs** | `docker compose logs backend` (`level=ERROR`, `corrId=...`) + optional Sentry DSN | Host SSH / Sentry |

---

## 3. Business Continuity Procedures

| Incident | Operational Procedure |
|---|---|
| **Orders interrupted during deployment** | `deploy-prod.sh` preserves `mysql_data`. Check `orders` and Razorpay Dashboard for in-flight payments; retry/reconcile from payment gateway status before manual adjustment. |
| **Payment webhook failures** | `RazorpayWebhookController` is idempotent and signature-verified (`HmacSHA256`). Inspect `backend` logs by `corrId`, confirm Razorpay Dashboard webhook delivery logs, and replay failed webhooks from Razorpay Dashboard. |
| **COD orders** | COD orders remain available even if Razorpay/WhatsApp/Gemini are disabled or unreachable. |
| **Inventory inconsistency** | `InventoryService` & `OrderService` use `@Transactional` + InnoDB `PESSIMISTIC_WRITE` (`TreeMap` sorted IDs). Never edit `vegetables` stock directly in MySQL; use admin inventory adjustment endpoints so audit trails remain intact. |
| **Duplicate orders** | Checkout uses `clientRef` idempotency. If a customer reports a duplicate charge, verify `orders` + Razorpay payment IDs before issuing any refund. |
| **Delivery failures / Customer complaints** | Staff/Owner inspect `delivery_attempts`, `delivery_otps`, and POD images (`backend/data/private-uploads`) via admin UI. |
| **Admin account compromise** | Immediately lock/disable the compromised user or rotate password, rotate `JWT_SECRET` (invalidates all active tokens), and review `backend` logs. |
| **Temporary website downtime** | Check `docker compose ps`, `/actuator/health/readiness`, and `/nginx-health`. If caused by a recent release without breaking DDL, execute `APP_VERSION=<prev> bash scripts/rollback-prod.sh`. |

---

## 4. Post-Deployment Performance Baseline Plan

Run only **after** VPS deployment (never run unthrottled load tests against live customer traffic):

| Check | Target / Initial Threshold | Method |
|---|---|---|
| **Homepage & static PWA load** | `< 1.0s` TTFB / `< 2.5s` full load | `curl -w` / browser DevTools |
| **Public catalog (`GET /api/public/vegetables`)** | `< 300ms` p95 | `curl -w "%{time_total}\n"` |
| **Auth (`/api/auth/login`) & Cart / Checkout** | `< 500ms` p95 (stay under `auth_limit` `5r/m` when testing) | Functional smoke test |
| **Readiness (`GET /actuator/health/readiness`)** | `< 150ms` (`200 UP`) | `docker compose exec` / external probe |
| **Host CPU / RAM / Disk I/O** | CPU `< 70%` sustained, RAM `< 80%`, Disk `< 80%` | `docker stats --no-stream`, `free -h`, `df -h` |
