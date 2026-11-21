# TazaTokri Production Maintenance Schedule

Perform all production updates through a controlled change window (never auto-upgrade MySQL major versions or apply unreviewed Flyway migrations directly in production).

---

## Daily Checks (Automated + Quick Review)
- Verify external uptime monitor shows `200 UP` on `https://<domain>/actuator/health/readiness`.
- Verify `GET /api/ops/health` (`lastBackup.status == SUCCESS`, age `< 24h`) and offsite sync completion.
- Confirm disk usage (`df -h`) is `< 75%` and no containers are restarting (`docker compose ps`).

## Weekly Checks
- Review `docker compose logs --since 7d backend | grep "level=ERROR"` for recurring exceptions or payment webhook warnings.
- Review `fail2ban` status (`sudo fail2ban-client status sshd`) and UFW rules (`sudo ufw status`).
- Verify `unattended-upgrades` applied Ubuntu security patches cleanly and check if a scheduled reboot is required (`/var/run/reboot-required`).

## Monthly Checks
- Run an **isolated restore drill** (`RESTORE_MODE=docker TEST_DB_NAME=tazatokri_restore_verify bash scripts/restore-mysql-test.sh <latest.sql.gz.enc>`) and test extracting the latest uploads archive.
- Review `scripts/tls-renew.sh` logs and confirm certificate expiry is `> 30` days away.
- Review local/offsite backup retention (`14` days local, `30–90` days offsite) and clean up unused non-retained old Docker build cache only if needed (never prune active or rollback `APP_VERSION` images without verifying retained tags).

## Quarterly Checks
- Review and apply tested backend (Maven/Spring Boot) and frontend (npm) dependency security updates in staging before deploying via `scripts/deploy-prod.sh`.
- Review Docker Engine / MySQL `8.4.x` patch releases and test Flyway migrations on a staging copy before production rollout.
- Rotate `JWT_SECRET` / `BACKUP_ENCRYPTION_PASSPHRASE` / SSH keys as planned and verify escrowed passphrase access.
