# TazaTokri Monitoring & Alerting Setup

## 1. Implementation Status Summary

| Capability | Status | Details |
|---|---|---|
| **Backend Liveness & Readiness Probes** | **Configured (Code)** | `/actuator/health/liveness` (DB-independent) and `/actuator/health/readiness` (`conn.isValid(2)`) in `OperationalHealthController`. |
| **Nginx Local Health Endpoint** | **Configured (Code)** | `GET /nginx-health` (localhost-only `200 ok`) in `infra/nginx/default.conf`. |
| **Operational Summary Endpoint** | **Configured (Code)** | `GET /api/ops/health` (`OWNER`/`STAFF`) returning DB status, version, providers, and `lastBackup` metadata. |
| **Structured Scrubbed Logging & Rotation** | **Configured (Code)** | `logback-spring.xml` + `LogScrubber` + `CorrelationIdFilter` + Docker `json-file` (`10m` × `5`). |
| **External Uptime & TLS Expiry Alerts** | **Not Yet Active** | Requires provisioning on VPS / external SaaS monitor. |
| **Host Disk / Backup Failure Alerts** | **Not Yet Active** | Requires VPS cron alert hooks. |
| **External Error Telemetry (Sentry)** | **Optional / Not Active** | Requires setting `SENTRY_DSN` in `.env` and transport integration if desired. |

---

## 2. Recommended Affordable Monitoring Stack

| Component | Recommended Tool | Estimated Cost | Purpose |
|---|---|---|---|
| **External Uptime & TLS Expiry** | UptimeRobot (Free / Pro) or Better Stack (Free tier) | `$0–$10 / month` | Poll `https://<domain>/actuator/health/readiness` every `1–5` min + TLS expiry warning at `14` and `7` days. |
| **Host Disk & Backup Alerts** | Lightweight VPS cron script + email/Telegram/Slack webhook | `$0 / month` | Alert on disk `>= 80%`, container exit, or `backup-status.json` `"status": "FAILED"` / age `> 26h`. |
| **Error Tracking (Optional)** | Sentry Developer / Team free tier | `$0 / month` | Capture unhandled backend/frontend exceptions. |

---

## 3. Alert Thresholds & Destinations

| Signal | Warning Threshold | Critical Threshold | Destination |
|---|---|---|---|
| **HTTPS Endpoint Down** | 1 failed probe | 2 consecutive failures (`503` / timeout) | Email + SMS / Telegram / Slack |
| **TLS Certificate Expiry** | `< 14 days` remaining | `< 7 days` remaining | Email + Slack |
| **Disk Usage (`/`)** | `>= 75%` | `>= 85%` | Email + Slack |
| **RAM / Swap Usage** | RAM `>= 85%` | Swap `>= 70%` or OOM kill | Email + Slack |
| **Backup Status** | Age `> 26 hours` | `"status": "FAILED"` or missing offsite sync | Email + Slack |
| **Container State** | Restart count increasing | `mysql` / `backend` / `frontend` down/unhealthy | Email + Slack |

---

## 4. Setup Instructions (Post-VPS Deployment)

1. Create an HTTP(S) monitor in UptimeRobot / Better Stack targeting `https://<domain>/actuator/health/readiness` (expect HTTP `200` and keyword `"UP"`).
2. Enable SSL/TLS expiry notifications (`14` days and `7` days before expiration).
3. Add a VPS host cron check every `15` minutes checking `df -h`, `docker compose ps`, and `/opt/tazatokri/backend/data/backup-status/backup-status.json` age/status, sending a webhook/email on failure.
