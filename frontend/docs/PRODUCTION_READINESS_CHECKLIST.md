# TazaTokri — Production Readiness Checklist (Phase 5)

**Verification Date:** 2026-11-19  
**Status:** **ALL GATES PASSED (100% READY)**  

---

## 1. Security & Access Control
- [x] JWT authentication enforced with HMAC SHA-256.
- [x] Startup check warns if default development JWT secret is active.
- [x] Passwords hashed with BCrypt.
- [x] Zero plaintext secrets or credentials in source code.
- [x] IDOR protection verified on Orders, Baskets, Addresses, and Evidence photos.
- [x] Role-Based Access Control (`CUSTOMER`, `STAFF`, `DELIVERY`, `OWNER`) enforced via `@PreAuthorize`.
- [x] HTTP Security headers configured (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- [x] Global exception handler scrubs sensitive data and suppresses internal stack traces.
- [x] Proof of delivery upload verifies magic bytes (JPEG, PNG, WebP) and caps size at 5 MB.
- [x] Delivery OTP verified using constant-time hashed matching with max 5 attempts lockout.

---

## 2. Data Integrity & Concurrency
- [x] Pessimistic locking (`findByIdForUpdate`) protects vegetable inventory updates.
- [x] Multi-item orders acquire row locks in deterministic ascending vegetable ID order (deadlock-free).
- [x] Concurrency stress test verified: 25 simultaneous callers competing for 10 kg stock yielded exactly 10 successes, 15 rejections, and zero negative stock.
- [x] Order cancellations atomically restore stock without risk of duplicate restoration.
- [x] Wastage cannot exceed available inventory.
- [x] Flyway migrations `V1__baseline.sql` through `V4__phase4_delivery_otp_pod_and_ops.sql` validated.

---

## 3. Business Rules Compliance
- [x] Minimum order requirement enforced: ₹150 (₹149 rejected).
- [x] Standard delivery fee enforced: ₹30 for orders under ₹300.
- [x] Free delivery threshold enforced: orders >= ₹300 receive ₹0 delivery fee.
- [x] Cutoff time: 6:00 PM (18:00) IST for same-day delivery.
- [x] Online payment hold: 15 minutes before expiration.
- [x] Delivery restricted to configured Pune PIN codes (`411026`, `411039`).
- [x] Units supported: kg, grams, bunches, pieces.
- [x] 36/36 studio vegetable photographs verified present and licensed.

---

## 4. Performance & Reliability
- [x] P95 latency under high contention: 11.6 ms.
- [x] P99 latency under high contention: 14.1 ms.
- [x] Zero database deadlocks during multi-threaded stress tests.
- [x] Client-side bundle optimized with code splitting (`vendor-react`, `vendor-query`, `vendor-ui`, `vendor-charts`).
- [x] PWA offline caching configured with Workbox precaching 97 assets.

---

## 5. Automated Testing Gate
- [x] Backend JUnit test suite: **9 / 9 passed** (0 failures, 0 errors).
- [x] Frontend Vitest suite: **21 / 21 files passed, 98 / 98 tests passed**.
- [x] Frontend TypeScript typecheck: **0 errors**.
- [x] Frontend ESLint: **0 errors, 0 warnings**.
- [x] Studio photograph verification: **36 / 36 present**.
- [x] Production build: **Clean compile, 0 errors**.

---

## 6. Disaster Recovery & Operations
- [x] Automated database backup script (`scripts/backup-mysql.ps1` & `.sh`) with SHA-256 verification.
- [x] Isolated test database restore script (`scripts/restore-mysql-test.ps1` & `.sh`) verified.
- [x] Safety block prevents accidental overwrite of live database (`tazatokri` or `tazatokri_prod`).
- [x] Operational health endpoint (`GET /api/ops/health`) tracks backup status and provider availability.
- [x] Public actuator probe (`GET /actuator/health`) provides liveness/readiness signals for Docker/K8s.

---

## 7. Deployment Readiness
- [x] Multi-stage hardened `backend/Dockerfile` using Eclipse Temurin 21 JRE and non-root user (UID 1001).
- [x] Multi-stage hardened `frontend/Dockerfile` using Nginx Alpine with SPA fallback and security headers.
- [x] `docker-compose.yml` configures complete stack (`mysql:8.4`, `backend`, `frontend`, persistent volumes, healthchecks).
- [x] GitHub Actions CI workflow (`.github/workflows/ci.yml`) executes all quality gates automatically.
