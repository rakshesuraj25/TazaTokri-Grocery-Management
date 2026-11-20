# Phase 6A.3 — Test Evidence & Technical Verification Log

**Project:** TazaTokri Fresh Produce Delivery Platform  
**Execution Phase:** Phase 6A.3  
**Date:** November 20, 2026  
**Java Version:** Java 21 (Oracle Corporation)  
**Database:** MySQL 8.4.13 Community Server (Container: `tazatokri_phase6a2_mysql`, Port: 3307)  
**Target Database:** `tazatokri_phase6a3_test`  
**Restore Database:** `tazatokri_phase6a3_restore`  

---

## 1. Maven Compilation Evidence

Executing `backend/mvnw.cmd test-compile`:
```text
[INFO] --- resources:3.5.0:resources (default-resources) @ tazatokri-backend ---
[INFO] Copying 3 resources from src\main\resources to target\classes
[INFO] Copying 4 resources from src\main\resources to target\classes
[INFO] --- compiler:3.15.0:compile (default-compile) @ tazatokri-backend ---
[INFO] Nothing to compile - all classes are up to date.
[INFO] --- resources:3.5.0:testResources (default-testResources) @ tazatokri-backend ---
[INFO] Copying 1 resource from src\test\resources to target\test-classes
[INFO] --- compiler:3.15.0:testCompile (default-testCompile) @ tazatokri-backend ---
[INFO] Recompiling the module because of changed source code.
[INFO] Compiling 4 source files with javac [debug parameters release 21] to target\test-classes
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time: 9.234 s
[INFO] Finished at: 2026-11-20T15:43:16+05:30
```
**Compiled Test Classes:**
1. `com.tazatokri.TazatokriBackendApplicationTests` (Unit test suite)
2. `com.tazatokri.Phase6a2RealMySQLIntegrationTest` (Phase 6A.2 integration test)
3. `com.tazatokri.Phase6a3RealSpringIntegrationTest` (Phase 6A.3 Spring service & API test)
4. `com.tazatokri.Phase6a3BackupRestoreTest` (Phase 6A.3 physical backup & restore test)

---

## 2. Spring Service Concurrency Test Evidence

**Test Method:** `Phase6a3RealSpringIntegrationTest.test01_verifyRealSpringServiceLevelConcurrencyAndPessimisticLocking`
- **Application Context:** Full Spring Boot Application (`@SpringBootTest`)
- **Beans Injected:** `InventoryService`, `VegetableRepository`, `StockMovementRepository`, `UserRepository`
- **Pessimistic Locking:** Verified using JPA `@Lock(LockModeType.PESSIMISTIC_WRITE)` via `VegetableRepository.findByIdForUpdate(Long id)`
- **Concurrency Setup:**
  - Vegetable ID: `99993`
  - Initial Purchase Stock: `10.000 KG`
  - Threads: 10 concurrent worker threads managed via `Executors.newFixedThreadPool(10)`
  - Synchronization Barrier: `CountDownLatch(1)`
  - Demand per Thread: `2.000 KG` (Total demand = 20.000 KG against 10.000 KG available)
- **Expected Results:**
  - Succeeded Transactions: **5** (5 * 2.000 KG = 10.000 KG deducted)
  - Rejected Transactions: **5** (5 thrown `InsufficientStockException`)
  - Final MySQL Database Stock: **`0.000 KG`**
  - Overselling / Negative Stock: **`0.000 KG` (Prevented)**
  - Ledger Entries in MySQL: **5 deductions recorded in `stock_movements`**

---

## 3. Real API MockMvc Test Evidence

**Test Method:** `Phase6a3RealSpringIntegrationTest.test02_verifyRealApiOrderEndpointsAndBusinessRules`
- **HTTP Server / Framework:** Spring MockMvc with full `springSecurityFilterChain`
- **Endpoint Tested:** `POST /api/customer/orders`
- **Authentication:** Real JWT token signed with HMAC-SHA256 containing subject `8888888884` and role `ROLE_CUSTOMER`

| Test Scenario | Request Payload / Parameter | Expected HTTP Status | Verified Response Assertion |
|---|---|:---:|---|
| **Min Order Rejected** | 3 units * ₹40 = ₹120.00 | `400 Bad Request` | `$.message: "Minimum order is Rs 150"` |
| **Min Order Accepted** | 4 units * ₹40 = ₹160.00 | `201 Created` | `$.subtotal: 160.00, $.deliveryFee: 30.00, $.estimatedTotal: 190.00` |
| **Free Delivery** | 8 units * ₹40 = ₹320.00 | `201 Created` | `$.subtotal: 320.00, $.deliveryFee: 0.00, $.estimatedTotal: 320.00` |
| **Unserviceable PIN** | PIN `411001` | `400 Bad Request` | `$.message: "We do not deliver to pincode 411001 yet"` |
| **Invalid Quantity** | `count: 0` | `400 Bad Request` | Validation failure on `@Min(1)` |
| **Invalid Payload** | `clientRef: ""` | `400 Bad Request` | Validation failure on `@NotBlank` |
| **Unauthenticated** | Missing `Authorization` header | `403 Forbidden` | Access denied by Spring Security |
| **Idempotency** | Duplicate `clientRef` | `201 Created` | Reuses existing order record |

---

## 4. Physical Backup and Restore Test Evidence

**Test Method:** `Phase6a3BackupRestoreTest`
- **Backup File:** `C:\Taza_Tokri\backups\phase6a3\tazatokri_phase6a3_backup.sql`
- **Source DB:** `tazatokri_phase6a3_test`
- **Restore Target DB:** `tazatokri_phase6a3_restore`
- **Table Count Exported:** 29 tables
- **Table Count Restored:** 29 tables
- **Row Count Discrepancies:** 0
- **Foreign Key Enforcement:** Verified active (`foreign_key_checks = 1`)
- **Transaction Isolation:** `REPEATABLE-READ`
