# TazaTokri — Production Security Checklist

## 1. Authentication, Authorization & Ownership
- [x] Stateless JWT authentication via `SecurityConfig.java` & `JwtAuthFilter.java`; no session fixation.
- [x] Role-based access (`OWNER`, `STAFF`, `DELIVERY`, `CUSTOMER`) enforced via `@PreAuthorize` on all controllers.
- [x] Customer order ownership enforced (`findWithDetailsByIdAndCustomerId`, `authorizeOrderEvidenceRead`).
- [x] Delivery driver isolation enforced (`myActive(orderId, actor.getId())` prevents drivers from accessing or modifying unassigned deliveries).

## 2. Delivery OTP & Proof-of-Delivery Security
- [x] 6-digit OTPs generated server-side via `java.security.SecureRandom`.
- [x] Stored solely as BCrypt hashes in `delivery_otps`; never exposed in API responses or logs.
- [x] Max failed attempts (`DELIVERY_OTP_MAX_ATTEMPTS`, default 5) locks brute-force attempts.
- [x] OTPs expire (`DELIVERY_OTP_TTL_MINUTES`, default 30m), invalidate on reissue, and cannot be reused or verified on `CANCELLED` / `DELIVERED` orders.
- [x] Manual OTP overrides require a `>= 10`-char reason and write to `delivery_audit_logs`.
- [x] POD photo uploads validate magic bytes (JPEG, PNG, WebP), enforce size limits, generate non-guessable UUID keys (`pod/<uuid>.<ext>`), block path traversal, and serve with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

## 3. Monitoring, Logging, Headers & Backups
- [x] `CorrelationIdFilter` sets `X-Correlation-Id`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy`.
- [x] `LogScrubber` and `scrubSensitiveFrontendText` redact JWTs, passwords, API keys, and 6-digit OTPs.
- [x] `/actuator/health`, `/actuator/health/liveness`, `/actuator/health/readiness` expose only `UP`/`DOWN` without credentials; `/api/ops/health` requires `OWNER` or `STAFF`.
- [x] `CORS_ALLOWED_ORIGINS` is environment-configurable and restricted in production.
- [x] MySQL backups use `MYSQL_PWD` env var (never hardcoded passwords) and include SHA-256 verification.
