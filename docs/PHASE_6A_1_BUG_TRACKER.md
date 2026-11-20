# TazaTokri — Phase 6A.1: Bug Tracker & Issue Log

**Date:** November 20, 2026  
**Phase:** 6A.1 (Family & Staff Pilot Operational Validation)  
**Status:** All critical and blocking defects fixed; non-blocking environment limits documented.

---

## 1. Summary of Defects & Findings

| Bug ID | Component | Severity | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-6A1-001** | Frontend / Test Runner | `MEDIUM` | Vitest OOM crash (`Zone Allocation failed`) during multi-threaded test runs on Windows | **RESOLVED** |
| **BUG-6A1-002** | Frontend / Build | `HIGH` | Hardcoded `http://localhost:8080` baked into production bundles | **RESOLVED** |
| **BUG-6A1-003** | Backend / Security | `CRITICAL` | Permissive fallback credentials (`DB_PASSWORD:Owner@123`, dev JWT keys) in base configuration | **RESOLVED** |
| **BUG-6A1-004** | Backend / Test Harness | `LOW` | Missing proxy handlers in test mock repositories for derived query methods | **RESOLVED** |
| **BUG-6A1-005** | E2E Testing | `LOW` | Playwright test suite relies on synthetic route mocking rather than live DB backend | **DOCUMENTED** |
| **BUG-6A1-006** | DevOps / Testing | `MEDIUM` | Docker engine offline on Windows host prevents live MySQL InnoDB concurrency stress test | **DOCUMENTED** |

---

## 2. Detailed Bug Entries

### BUG-6A1-001: Vitest OOM Crash on Windows
- **Component:** `frontend/` (Vitest test suite)
- **Severity:** `MEDIUM`
- **Symptom:** Running `npm run test` failed intermittently with: `FATAL ERROR: Zone Allocation failed - process out of memory`.
- **Root Cause:** Default Vitest worker thread pooling spawns multiple parallel Node.js V8 isolates that collectively exceed memory limits on Windows developer machines when parsing 21 jsdom test files.
- **Resolution:** Updated `test` script in `frontend/package.json` to specify `vitest run --pool=forks --poolOptions.forks.singleFork`.
- **Verification:** Ran `npm run test`; completed 21/21 files and 98/98 tests successfully in 21.7s without memory pressure.

---

### BUG-6A1-002: Hardcoded Localhost API URL in Production Bundles
- **Component:** `frontend/` (Vite build configuration)
- **Severity:** `HIGH`
- **Symptom:** Inspecting `dist/assets/index-*.js` revealed literal occurrences of `http://localhost:8080`. In production, client browsers outside localhost would fail to connect to APIs.
- **Root Cause:** `frontend/.env` defined `VITE_API_URL=http://localhost:8080`, and `frontend/src/lib/api.ts` used `baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080'`.
- **Resolution:** 
  1. Created `frontend/.env.production` with empty `VITE_API_URL=`.
  2. Updated `frontend/src/lib/api.ts` to `import.meta.env.VITE_API_URL ?? ''`, allowing relative path API dispatch in production behind reverse proxies.
- **Verification:** Ran `npm run build` and inspected output files; confirmed 0 occurrences of `localhost:8080`.

---

### BUG-6A1-003: Permissive Fallback Credentials in Base Configuration
- **Component:** `backend/` (Spring Boot Configuration & Security)
- **Severity:** `CRITICAL`
- **Symptom:** Base `application.properties` permitted startup with default weak credentials if environment variables were omitted.
- **Root Cause:** Spring properties used fallback syntax: `${DB_PASSWORD:Owner@123}`, `${JWT_SECRET:tazatokri-dev-secret...}`.
- **Resolution:**
  1. Removed all default password/secret fallbacks from `application.properties`.
  2. Added dedicated `application-prod.properties` and `application-dev.properties`.
  3. Implemented `ProductionSecurityHardeningValidator.java` listening to `ApplicationEnvironmentPreparedEvent` to reject application boot if secrets are missing, below 32 bytes, or set to development defaults when running under `prod`.
- **Verification:** `ProductionSecurityHardeningValidatorTest` confirms fast failure on missing or insecure secrets.

---

### BUG-6A1-004: Missing Proxy Handlers in Test Repositories
- **Component:** `backend/` (JUnit test infrastructure)
- **Severity:** `LOW`
- **Symptom:** Dynamic proxy stubs for `AddressRepository` and `DeliveryAttemptRepository` threw `UnsupportedOperationException` on derived method calls like `findByIdAndUserId` and `findFirstByOrderIdAndStatusIn`.
- **Root Cause:** Mock proxy invocation handler only matched a subset of method names needed by `OrderService` and `DeliveryService`.
- **Resolution:** Extended proxy handlers in `TazatokriBackendApplicationTests.java` to support all required derived queries.
- **Verification:** Full Maven test execution (`./mvnw test`) passes 12/12 suites.

---

### BUG-6A1-005: Playwright E2E Route Mocking Limitation
- **Component:** `frontend/tests/e2e/`
- **Severity:** `LOW` (Operational Awareness)
- **Observation:** `critical-flows.spec.ts` mocks network requests via `page.route` rather than communicating with a live Spring Boot backend.
- **Impact:** E2E tests validate client-side routing, state transitions, and UI error handling, but do not validate live network serialization or database transactions.
- **Recommendation:** Maintain existing mock tests for client UI verification; execute full-stack smoke tests during the family pilot stage.

---

### BUG-6A1-006: Inability to Execute Live MySQL Concurrency Test
- **Component:** `DevOps / Test Harness`
- **Severity:** `MEDIUM` (Operational Awareness)
- **Observation:** Docker Desktop is offline on the development machine (`docker info: exit code 1`). No live MySQL 8.4 engine is currently active.
- **Impact:** Multi-threaded InnoDB row lock contention (`SELECT ... FOR UPDATE`) cannot be validated against a live storage engine in this environment.
- **Mitigation:** The application architecture uses standard JPA `@Lock(LockModeType.PESSIMISTIC_WRITE)` and database-level unique constraints (`uk_orders_client_ref`). Must be verified in staging before general public rollout.
