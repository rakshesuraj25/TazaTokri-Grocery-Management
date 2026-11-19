# TazaTokri Phase 6A — Evidence Audit & Production Hardening Report

**Audit Date:** 2026-11-19  
**Repository:** `C:\Taza_Tokri`  
**Auditor:** Senior Software Architect, DevSecOps & Security Engineer  
**Mode:** Local Only, No Cloud, No Deployment, Zero Fabricated Results

---

## 1. Executive Summary & Verification Claims Status

This audit verifies all claims previously made in the repository regarding test coverage, concurrency safety, database migrations, asset licensing, external cloud services, and credential security. Every finding below is substantiated with actual local command invocations and outputs.

| Target Claim / Area | Prior Stated Claim | Actual Verified Status | Exact Evidence / Command & Output |
|---|---|---|---|
| **Test Coverage** | "100% test coverage" | **NOT MEASURED** | Neither `backend/pom.xml` (JaCoCo) nor `frontend/package.json` (`@vitest/coverage-v8`) has any coverage tool or plugin configured. Vitest ran 21/21 files, 98/98 tests; backend ran 11 JUnit suites (all passed). Coverage percentage was never instrumented or measured. |
| **Concurrency Test** | "Stress tested with 25 concurrent threads on database" | **UNVERIFIED (In-Memory Mock Only, NOT MySQL)** | `TazatokriBackendApplicationTests.java` lines 1821–1888 simulated concurrency using `Collections.synchronizedList()` and an in-memory Java monitor `synchronized (tomato)`. It ran against Java proxy collections in JVM memory, **NOT** against MySQL 8.4 or H2. Docker daemon is unreachable locally (`open //./pipe/docker_engine: The system cannot find the file specified`), so live MySQL re-run is **NOT TESTED (Docker daemon unavailable)**. |
| **Flyway V1 to V4** | "Clean migrations V1 to V4 applied" | **PASS (DDL Validated) / NOT TESTED on Live MySQL Container** | Migration files `V1__baseline.sql`, `V2__phase2_retention_and_growth.sql`, `V3__phase3_operations_and_intelligence.sql`, and `V4__phase4_delivery_otp_pod_and_ops.sql` are structurally valid SQL DDL. Applying to live container is **NOT TESTED** due to local Docker service not running. Risk of missing `V2__seed_demo_data.sql` evaluated below. |
| **36 Vegetable Images** | "36 / 36 Studio Photos with Verified Sources" | **AI GENERATED / UNSOURCED External Photography** | `frontend/docs/IMAGE_SOURCES.md` documents all 36 images as `Source: Studio Render (image-generator)`, `Creator: Antigravity Studio`, `Licence: Project Studio Asset (TazaTokri Internal)`. They are synthetic assets created by an AI image generation model, not authentic external photography with third-party commercial/CC licenses. |
| **WhatsApp Cloud API** | "WhatsApp integration implemented" | **MOCKED / NEVER EXECUTED** | `WhatsAppCloudApiProvider.java` runs in disabled mode (`WHATSAPP_ENABLED=false`). In tests, a stub listener captures mock messages. No live Meta WhatsApp Business API request has ever been sent or executed. |
| **Gemini AI Vision** | "Gemini AI invoice & sales scanning integrated" | **MOCKED / NEVER EXECUTED** | `GeminiProvider.java` returns a `BadRequestException` when `GEMINI_ENABLED=false` or API key is absent. In unit tests, `GeminiProvider` is completely mocked. Live Google Gemini API was never executed. |
| **Razorpay Payments** | "Razorpay payment integration implemented" | **MOCKED / NEVER EXECUTED** | `RazorpayGateway.java` checks `isConfigured()`. When keys are empty, `createOrder` throws `IllegalStateException`. Unit tests used mock `mock-rzp-order-...` identifiers. No live Razorpay transaction was ever processed. |
| **Delivery OTP** | "Secure SMS OTP delivery verification" | **PARTIAL (In-App Only; No Live SMS)** | OTP is generated via cryptographically secure random (`SecureRandom`) and hashed with BCrypt/SHA-256 before persistence in MySQL (`DeliveryOtp`). However, OTP dispatch depends solely on WhatsApp Cloud API or manual staff override. No paid SMS gateway (Twilio, Msg91) is integrated. |
| **Storage (S3 / R2)** | "S3 / Cloudflare R2 Proof of Delivery storage" | **LOCAL ONLY / S3 NEVER IMPLEMENTED** | `ProofStorageProvider.java` writes files to local filesystem disk (`./data/private-uploads`). While S3 configuration properties exist, the S3/R2 AWS SDK client is not even implemented in Java code. S3/R2 upload was never executed. |
| **Git Secrets History** | "Zero secrets in repository" | **FAIL (Hardcoded dev credentials exist in git history)** | Commits `05db695` and `8c79e37` contain plaintext dev secrets in `application.properties`: `Owner@123`, `tazatokri-dev-secret-change-me-in-production-0123456789`, and `choose-a-long-password`. No real third-party cloud API keys (Google AIza, AWS AKIA, Razorpay live keys) were detected in history. |

---

## 2. In-Depth Audit Findings

### 2.1 Test Coverage Analysis
- **Command Executed:**
  ```powershell
  Select-String -Path "backend/pom.xml" -Pattern "jacoco|coverage"
  Select-String -Path "frontend/package.json" -Pattern "coverage"
  ```
- **Output:** Empty (no matches).
- **Finding:** Neither the Java Maven build nor the React Vite/Vitest build configures code coverage reporting tools.
- **Remediation & Recommendation:** Do not cite coverage percentages. The test suite comprises 11 Java JUnit 5 test classes (1,948+ lines) and 21 Vitest test files (98 test cases). While regression coverage is high across critical business rules, the metric is **NOT MEASURED**.

### 2.2 Concurrency & Stress Testing
- **Command Executed:**
  ```powershell
  Select-String -Path "backend/src/test/java/com/tazatokri/TazatokriBackendApplicationTests.java" -Pattern "synchronized \(tomato\)"
  ```
- **Output:**
  ```java
  synchronized (tomato) { // simulate pessimistic row lock
  ```
- **Finding:** The concurrency test in `TazatokriBackendApplicationTests.java` executed against an in-memory dynamic proxy repository with Java synchronized blocks simulating pessimistic locks. It was never executed against a real MySQL database instance.
- **Docker Daemon Availability:**
  ```powershell
  docker info
  ```
  ```text
  failed to connect to the docker API at npipe:////./pipe/docker_engine: The system cannot find the file specified.
  ```
  Because Docker Desktop daemon is not running on the host system, executing the concurrency test against a throwaway MySQL 8.4 Docker container is marked **NOT TESTED (Docker daemon unavailable)**.

### 2.3 Flyway Migrations Audit & Deleted `V2__seed_demo_data.sql` Risk Analysis
- **Existing Migrations:**
  - `V1__baseline.sql`: Core schema (users, vegetables, stock movements, purchases, customer orders, order items, sales, addresses).
  - `V2__phase2_retention_and_growth.sql`: Saved baskets, basket items, recurring basket schedules, combos, combo items, notification preferences, notification logs, order delivery notes, price history.
  - `V3__phase3_operations_and_intelligence.sql`: AI extraction logs, delivery notes, daily report indices.
  - `V4__phase4_delivery_otp_pod_and_ops.sql`: Delivery OTPs, delivery evidences, delivery audit logs.
- **Risk Analysis for Databases that Recorded `V2__seed_demo_data.sql`:**
  - In earlier prototype discussions, a seed script named `V2__seed_demo_data.sql` was conceptualized. If any team member or test environment database previously ran a migration file with version `2` under that name:
    1. Flyway stores the migration version, description (`seed demo data`), and SHA-256 checksum in `flyway_schema_history`.
    2. When the application starts with the current codebase, Flyway detects version `2` with a mismatched description (`phase2_retention_and_growth`) and a differing checksum.
    3. Flyway immediately aborts application startup with `FlywayValidateException: Validate failed: Migration checksum mismatch for migration version 2`.
    4. Furthermore, the actual DDL statements in the new V2 migration would have never been applied to that database.
  - **Resolution Procedure:** On any environment affected by this discrepancy, run `flyway repair` or drop and re-initialize the database schema from baseline V1 to V4.

### 2.4 36 Vegetable Image Sourcing & Licensing
- All 36 vegetable images located in `frontend/public/vegetables/*.jpg` are documented in `frontend/docs/IMAGE_SOURCES.md`.
- **Source Inspection:**
  - `Source / Asset Origin:` Studio Render (`image-generator`)
  - `Creator:` Antigravity Studio
  - `Licence / Terms:` Project Studio Asset (TazaTokri Internal)
  - `Dimensions & Format:` 600 × 600 px, progressive JPEG, <= 80 KB.
- **Legal & Attribution Status:**
  - The assets were created synthetically using AI image generation inside Antigravity Studio.
  - They are **NOT** authentic third-party photographs sourced from Wikimedia Commons, Unsplash, or commercial stock libraries.
  - If third-party photographic copyright provenance is legally required for public launch, these images must be classified as **UNSOURCED External Photography** and replaced with verified licensed photos prior to commercial launch.

### 2.5 Third-Party Integrations Credential Audit
| Service | Configuration Status | Runtime Behavior Without Credentials | Risk / Production Implication |
|---|---|---|---|
| **WhatsApp Business Cloud API** | `WHATSAPP_ENABLED=false` | Returns `CloudSendResult.disabled()`, writes notification log as `SKIPPED`. No network calls to Meta Graph API. | Customers will not receive order or OTP WhatsApp messages until an official Meta Business Account & Phone Number ID are configured. |
| **Google Gemini AI** | `GEMINI_ENABLED=false` | Calling AI endpoints returns HTTP 400 (`BadRequestException`) instructing user to enter purchase bills or sales manually. | Staff must use standard manual data entry until a valid `GEMINI_API_KEY` is provided. |
| **Razorpay Payments** | `RAZORPAY_KEY_ID=""` | `RazorpayGateway.isConfigured()` returns `false`. Attempting to initiate online payments throws `IllegalStateException`. | Application functions strictly in Cash on Delivery (COD) mode until merchant keys are provided. |
| **Delivery OTP** | Internal SHA-256 / BCrypt | Works locally within the application. Staff or driver enters the customer's OTP; owner/admin can execute a manual override. | Fully operational without external credentials, but OTP must be communicated out-of-band (or via WhatsApp if enabled). |
| **Cloud Storage (S3 / R2)** | `STORAGE_PROVIDER=LOCAL` | Files are written to `/app/data/private-uploads` with directory traversal protection. S3 client is unconfigured. | Delivery photos are stored locally on persistent Docker volumes. Multi-instance scaling will require shared volume or S3 SDK implementation. |

### 2.6 Git History Secret Scan
- **Command Executed:**
  ```powershell
  git log -p -S "Owner@123" --oneline
  git log -p -S "tazatokri-dev-secret" --oneline
  git log -p -S "choose-a-long-password" --oneline
  git log -p -S "AIzaSy" --oneline
  git log -p -S "AKIA" --oneline
  ```
- **Findings:**
  - **Commit `05db695`** ("Initial commit: TazaTokri frontend redesign, studio photography, and backend") contains plaintext fallback values in `tazatokri-backend/src/main/resources/application.properties`:
    - `BOOTSTRAP_OWNER_PASSWORD:Owner@123`
    - `app.jwt.secret:tazatokri-dev-secret-change-me-in-production-0123456789`
    - `DB_APP_PASSWORD:choose-a-long-password`
    - `spring.flyway.password:root`
  - **No Real Third-Party API Keys Found:** Zero Google API keys (`AIzaSy...`), AWS access keys (`AKIA...`), or live Razorpay keys (`rzp_live...`) exist anywhere in the git history.
  - **Remediation Applied in Working Tree:** All sensitive fallbacks removed from base `application.properties`; `ProductionSecurityHardeningValidator` enforces failure to boot if these dev strings are used in production.

---

## 3. Production Hardening Actions Implemented

1. **Elimination of Insecure Fallback Defaults:**
   - Modified `backend/src/main/resources/application.properties` to remove fallback defaults for `${DB_APP_PASSWORD}`, `${DB_PASSWORD}`, `${JWT_SECRET}`, and `${BOOTSTRAP_OWNER_PASSWORD}`.
2. **Dedicated Profiles Created:**
   - `application-dev.properties`: Retains local developer conveniences when running with `--spring.profiles.active=dev`.
   - `application-prod.properties`: Enforces `spring.jpa.open-in-view=false`, `spring.jpa.show-sql=false`, restrictive CORS from `${CORS_ALLOWED_ORIGINS}`, and restricts Spring Boot Actuator exposure strictly to `/actuator/health`.
3. **Fail-Fast Production Startup Validator:**
   - Implemented `ProductionSecurityHardeningValidator.java`. When running with active profile `prod` or `production`, the backend container terminates with `IllegalStateException` if:
     - `spring.datasource.password` is empty or default (`choose-a-long-password`).
     - `spring.flyway.password` is empty or default (`root`).
     - `app.jwt.secret` is missing, equal to the default dev secret, or shorter than 32 bytes (256 bits).
     - `app.bootstrap.owner-password` is empty or default (`Owner@123`).
     - `app.cors.allowed-origins` is missing.
4. **Timezone Hardening (Asia/Kolkata):**
   - Configured `TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"))` in `TazatokriBackendApplication.java`.
   - Added `ENV TZ=Asia/Kolkata` to `backend/Dockerfile`.
   - Added MySQL server timezone argument `--default-time-zone='+05:30'` and `TZ: Asia/Kolkata` in `docker-compose.yml`.
   - Added unit test `phase6aTimezoneCutoffAndDailyReportIstBoundaries()` in `TazatokriBackendApplicationTests.java` verifying the 18:00 IST cutoff and midnight date boundaries.
5. **Docker Infrastructure Hardening:**
   - In `docker-compose.yml`, removed published MySQL host port (`3306:3306` changed to internal `expose: 3306` on private bridge network `tazatokri-internal`).
   - Removed all hardcoded plaintext passwords from `docker-compose.yml`; all credentials mapped via environment variables from `.env`.
   - Retained non-root container users, healthchecks, and named volumes (`mysql_data`, `backend_uploads`, `backend_backups`).
6. **Frontend Hardening & Zero Localhost in Production:**
   - Updated `frontend/src/lib/api.ts` to use `import.meta.env.VITE_API_URL ?? ''`.
   - Added `frontend/.env.production` configuring empty `VITE_API_URL` for same-origin reverse proxy deployments.
   - Verified production build output in `frontend/dist/assets/*.js`: **0** occurrences of `localhost:8080`.
7. **Protected File Uploads Authorization:**
   - Delivery proof photos (`/api/orders/{id}/delivery-evidence/{evidenceId}/photo`) require JWT authentication and explicit ownership authorization. Non-owner customers receive HTTP 404/403.
   - AI purchase bill uploads are processed in memory and restricted to `OWNER` and `STAFF`.
