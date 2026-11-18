# TazaTokri — Phase 4 Implementation Report: Production Readiness & Delivery Management

## 1. Executive Summary

Phase 4 prepares **TazaTokri** for real-world grocery operations by upgrading delivery dispatch & area grouping, enforcing 6-digit hashed OTP proof of delivery (with audited manual exception handling), introducing magic-byte-validated Proof-of-Delivery photo storage, adding production health & scrubbed error monitoring (`Actuator` + optional `Sentry`), automating MySQL backup & isolated restore verification, expanding Playwright E2E coverage, and hardening CI/CD & Docker containers.

---

## 2. Delivery Management Improvements (Task 1)

- **Staff Delivery Dispatch & Area Grouping (`GET /api/delivery/admin/board`, [StaffDeliveryBoardPanel.tsx](../src/features/delivery/components/StaffDeliveryBoardPanel.tsx)):**
  - Filters by delivery date, stage (`READY_FOR_DELIVERY`, `ASSIGNED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`, `RETURNED_TO_STORE`, `CANCELLED`), PIN code, and assigned delivery person.
  - Groups nearby deliveries by **PIN code**, **Locality**, and **Assigned Delivery Person**.
  - Supports **assignment** and **reassignment** (`POST /api/orders/{id}/assign`) and **Return to Store** (`POST /api/orders/{id}/return-to-store`) for failed deliveries.
- **Delivery Person Mobile-First Dashboard ([DeliveryOrdersPage.tsx](../src/features/delivery/pages/DeliveryOrdersPage.tsx), [DeliveryOrderCard.tsx](../src/features/delivery/components/DeliveryOrderCard.tsx)):**
  - Shows assigned drops, customer delivery instructions, direct `tel:` contact link, external Google Maps link, OTP/POD verification badges, and `Start Delivery` / `Deliver` / `Fail` actions.
  - Strictly scoped to the authenticated delivery user's active assignments.
- **Customer Location & Delivery Instructions ([AddressService.java](../../backend/src/main/java/com/tazatokri/user/AddressService.java), [CustomerOrderController.java](../../backend/src/main/java/com/tazatokri/order/CustomerOrderController.java)):**
  - Customers can save `deliveryInstructions`, optional `latitude`/`longitude` map pin coordinates, edit addresses (`PUT /api/customer/addresses/{id}`), and update order delivery instructions (`PATCH /api/customer/orders/{id}/delivery-instructions`) prior to packing.
  - PIN code serviceability is validated against `app.delivery.pincodes`.

---

## 3. Delivery OTP Verification & Audited Manual Exceptions (Task 2)

- **Secure Backend Generation (`POST /api/delivery/orders/{id}/otp/issue`):**
  - Uses `java.security.SecureRandom` to generate a 6-digit OTP and stores only its **BCrypt hash** in `delivery_otps` (`V4__phase4_delivery_otp_pod_and_ops.sql`).
  - Plaintext OTPs are **never** returned in API responses or written to logs.
  - Issuing a new OTP automatically invalidates any prior `ACTIVE` OTP for that order.
  - Delivered via official `WhatsAppCloudApiProvider` when configured, or falls back cleanly to customer-shared code verification.
- **Brute-Force & Reuse Protection (`POST /api/delivery/orders/{id}/otp/verify`):**
  - Enforces expiry (`DELIVERY_OTP_TTL_MINUTES`, default 30m) and max failed attempts (`DELIVERY_OTP_MAX_ATTEMPTS`, default 5, locking the OTP after exhaustion).
  - Rejects verification on `CANCELLED` or `DELIVERED` orders and prevents OTP reuse.
  - `DeliveryService.deliver(...)` blocks order completion unless `otpVerified == true`.
- **Audited Manual Exception (`POST /api/delivery/orders/{id}/otp/manual-override`):**
  - When a customer has no network or phone access, authorized staff/delivery personnel can record a manual exception requiring a mandatory reason (`>= 10` characters), written to `delivery_audit_logs`.

---

## 4. Proof of Delivery Photo Upload & Storage (Task 3)

- **Magic-Byte Validation & Private Storage ([ProofStorageProvider.java](../../backend/src/main/java/com/tazatokri/delivery/ProofStorageProvider.java)):**
  - Validates actual binary headers for **JPEG** (`FF D8 FF`), **PNG** (`89 50 4E 47 0D 0A 1A 0A`), and **WebP** (`RIFF....WEBP`), rejecting forged extensions.
  - Enforces configurable max size (`DELIVERY_POD_MAX_UPLOAD_BYTES`, default 5 MB) and generates non-guessable UUID storage keys (`pod/<uuid>.<ext>`).
  - Supports `LOCAL` private directory storage (`./data/private-uploads`) for development and optional `S3_R2` configuration for production.
- **Controlled Access (`GET /api/orders/{id}/delivery-evidence/{evidenceId}/photo`):**
  - Never exposes public URLs. Access is restricted to `OWNER`, `STAFF`, the assigned `DELIVERY` user, or the owning `CUSTOMER`, with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

---

## 5. Production Monitoring, Structured Logging & Backup/Restore (Tasks 4 & 5)

- **Actuator & Operational Health ([OperationalHealthController.java](../../backend/src/main/java/com/tazatokri/common/OperationalHealthController.java), [OperationalHealthCard.tsx](../src/features/report/components/OperationalHealthCard.tsx)):**
  - Public probes: `GET /actuator/health`, `/actuator/health/liveness`, `/actuator/health/readiness` (returns `UP` or `DOWN` only; no credentials).
  - Restricted operational dashboard endpoint: `GET /api/ops/health` (`OWNER`/`STAFF`), showing DB connectivity, application version, last backup status, and external provider flags.
- **Structured Logging & Optional Sentry ([CorrelationIdFilter.java](../../backend/src/main/java/com/tazatokri/common/CorrelationIdFilter.java), [LogScrubber.java](../../backend/src/main/java/com/tazatokri/common/LogScrubber.java), [SentryErrorReporter.java](../../backend/src/main/java/com/tazatokri/common/SentryErrorReporter.java), [sentry.ts](../src/lib/sentry.ts)):**
  - Assigns `X-Correlation-Id` to every request/response and sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy`.
  - Scrubs JWTs, passwords, API keys, and 6-digit OTPs before logging or reporting to optional Sentry (`SENTRY_DSN`, `VITE_SENTRY_DSN`).
- **Automated MySQL Backup & Isolated Restore Scripts ([backup-mysql.ps1](../../scripts/backup-mysql.ps1), [backup-mysql.sh](../../scripts/backup-mysql.sh), [restore-mysql-test.ps1](../../scripts/restore-mysql-test.ps1), [restore-mysql-test.sh](../../scripts/restore-mysql-test.sh)):**
  - Produces timestamped SQL dumps + `.sha256` checksums + `backup-status.json` + retention pruning.
  - Verified locally with `backup-mysql.ps1` and `restore-mysql-test.ps1`.

---

## 6. End-to-End Testing, CI/CD & Docker Hardening (Tasks 6 & 7)

- **Playwright E2E ([critical-flows.spec.ts](../tests/e2e/critical-flows.spec.ts)):** Covers customer catalog/Marathi search/COD checkout, staff Quick Sale POS & thermal receipt, and delivery login -> start -> OTP issue/wrong-OTP rejection/valid-OTP verification.
- **GitHub Actions CI ([ci.yml](../../.github/workflows/ci.yml)):** Runs frontend `npm ci`, `typecheck`, `lint`, `check:images`, `npm test`, `npm run build`, Playwright E2E, and backend `./mvnw test`.
- **Dockerfiles ([backend/Dockerfile](../../backend/Dockerfile), [frontend/Dockerfile](../../frontend/Dockerfile)):** Multi-stage builds, non-root `tazatokri` user (UID 1001) on backend, security headers on Nginx, and container `HEALTHCHECK` probes.
