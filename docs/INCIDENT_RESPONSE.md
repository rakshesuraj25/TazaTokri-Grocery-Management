# TazaTokri Security Operations & Incident Response

## 1. Security Operations Baseline

- **SSH & Firewall:** Key-based SSH only (`PermitRootLogin no`, `PasswordAuthentication no`), `fail2ban` active, UFW allowing only `22/tcp`, `80/tcp`, `443/tcp`.
- **Network Isolation:** `mysql` (`3306`) and `backend` (`8080`) use `expose` on `tazatokri-internal` only; `frontend` Nginx terminates TLS 1.2/1.3 + HSTS + rate limiting.
- **Secrets & Accounts:** Production secrets live only in `/opt/tazatokri/.env` (`chmod 600`); `JWT_SECRET` (`>= 32` chars), DB passwords, Razorpay keys, and `BACKUP_ENCRYPTION_PASSPHRASE` are never logged (`LogScrubber`) or committed to Git.
- **CORS & Admin Access:** `CORS_ALLOWED_ORIGINS` restricted to exact `https://` origin(s); `OWNER`/`STAFF` endpoints protected by RBAC (`SecurityConfig`).

---

## 2. Security Incident Response Procedure (8 Steps)

1. **Detect:** Triggered by external uptime/error alerts, unusual `401`/`403`/`429` spikes in Nginx `access.log`, `fail2ban` bans, or unauthorized admin/order activity.
2. **Assess:** Determine scope (edge probe vs. compromised admin account vs. host/DB compromise) using `corrId` in `backend` logs and Nginx logs (`docker compose logs`).
3. **Contain:**
   - Block attacker IP via UFW (`sudo ufw deny from <IP>`) or Nginx.
   - If an admin/staff account is compromised, disable/change the account password immediately.
   - If host compromise is suspected, stop `backend` (`docker compose stop backend`) to halt writes while preserving volatile evidence if needed.
4. **Preserve Evidence:** Archive relevant `docker compose logs`, Nginx logs, and `/var/log/auth.log` to a read-only forensic directory **without** exposing secrets publicly.
5. **Recover:** Patch the vulnerability or roll back to a known-good `APP_VERSION` (or restore from clean offsite backup if DB integrity was compromised).
6. **Rotate Credentials:** Rotate all potentially exposed secrets (`JWT_SECRET` to invalidate all active JWTs, `DB_APP_PASSWORD`, `DB_ROOT_PASSWORD`, `BOOTSTRAP_OWNER_PASSWORD`, Razorpay `KEY_SECRET`/`WEBHOOK_SECRET`, `BACKUP_ENCRYPTION_PASSPHRASE`, SSH keys).
7. **Validate:** Verify `/actuator/health/readiness`, `/nginx-health`, HTTPS, and normal auth/checkout flows.
8. **Document:** Record timeline, root cause, affected data, rotated secrets, and preventive action items.

---

## 3. Common Incident Log Troubleshooting

- **Trace an API failure:** Grab `X-Correlation-Id` from the API error response and search `docker compose logs backend | grep <corrId>`. (Passwords, JWTs, API keys, and OTPs are automatically redacted by `LogScrubber`.)
- **Rate-limit false positives (`429`):** Check `infra/nginx/default.conf` zones (`auth_limit` `5r/m`, `customer_order_payment_limit` `30r/m`, `webhook_limit` `120r/m`) and `access.log` `status=429`.
- **Database connection errors:** Check `docker compose ps` (`mysql` healthy) and `docker compose logs mysql`.
