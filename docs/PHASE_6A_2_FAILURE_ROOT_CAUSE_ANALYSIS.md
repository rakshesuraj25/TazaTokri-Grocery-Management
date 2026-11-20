# TazaTokri — Phase 6A.2: Root Cause Analysis of Real MySQL 8.4 Test Failures

**Date:** November 20, 2026  
**Auditor:** Senior Software Architect, Database Specialist, QA Automation Engineer  
**Target Environment:** Real MySQL 8.4.13 on Docker (Port: 3307, Database: `tazatokri_phase6a2_test`)  
**Scope:** Root-cause investigation of test failures encountered during real-infrastructure validation in Windows CMD.  
**Status:** Investigation Complete — All 3 Failures Analyzed & Documented (No fixes implemented yet per instructions).

---

## 1. Executive Summary & Verification Milestones

The real MySQL 8.4.13 integration test suite (`Phase6a2RealMySQLIntegrationTest`) was executed via Maven from Windows CMD against the isolated disposable database:
- **Host / Port:** `localhost:3307`
- **Database:** `tazatokri_phase6a2_test`
- **Engine:** MySQL Community Server 8.4.13 (Linux/WSL2 Docker container `tazatokri_phase6a2_mysql`)
- **Isolation:** Verified exclusively targeting `tazatokri_phase6a2_test`; zero connection to development or production databases.

### Execution Progress & Resolved Items
The first rerun successfully validated and resolved:
1. **Flyway Migration & Schema Assertions (PASS):** All 22 core schema tables verified on MySQL 8.4, including `delivery_evidences` and `delivery_audit_logs`.
2. **Flyway Version Reporting (PASS):** `flyway.info().current().getVersion()` successfully validated at Version 4.
3. **Vegetable Entity Timestamp Requirements (PASS):** `created_at` and `updated_at` timestamps inserted successfully into `vegetables`.
4. **Strict Business Rule Boundaries (PASS):** ₹149.99 vs ₹150.00, ₹299.99 vs ₹300.00 free delivery, 17:59 vs 18:00 cutoff, and PIN codes passed.

### Current Open Failure (Failure 3)
The test halted at **Line 184** during the initial stock inward insert for the concurrency test:
```text
java.sql.SQLSyntaxErrorException: Unknown column 'user_id' in 'field list'
    at com.mysql.cj.jdbc.exceptions.SQLError.createSQLException(SQLError.java:121)
    at Phase6a2RealMySQLIntegrationTest.java:184
```

---

## 2. Comprehensive Inventory of the 29 MySQL Schema Tables

Inspection of `backend/src/main/resources/db/migration/` confirms the 29 tables present in `tazatokri_phase6a2_test`:

| Migration Script | Table Name | Type / Domain | JPA Entity Mapping |
| :--- | :--- | :--- | :--- |
| **V1__baseline.sql** | `categories` | Core Catalog | `com.tazatokri.catalog.Category` |
| **V1__baseline.sql** | `users` | Auth & Users | `com.tazatokri.user.User` |
| **V1__baseline.sql** | `suppliers` | Purchasing | `com.tazatokri.purchase.Supplier` |
| **V1__baseline.sql** | `sales` | POS / Counter | `com.tazatokri.sales.Sale` |
| **V1__baseline.sql** | `orders` | Customer Orders | `com.tazatokri.order.CustomerOrder` |
| **V1__baseline.sql** | `vegetables` | Core Catalog | `com.tazatokri.catalog.Vegetable` |
| **V1__baseline.sql** | `addresses` | Customer Addresses | `com.tazatokri.user.Address` |
| **V1__baseline.sql** | `user_roles` | Security RBAC | `@ElementCollection User.roles` |
| **V1__baseline.sql** | `purchases` | Inventory Intake | `com.tazatokri.purchase.Purchase` |
| **V1__baseline.sql** | `delivery_attempts` | Logistics | `com.tazatokri.delivery.DeliveryAttempt` |
| **V1__baseline.sql** | `payments` | Financials / COD | `com.tazatokri.payment.Payment` |
| **V1__baseline.sql** | `order_items` | Customer Orders | `com.tazatokri.order.OrderItem` |
| **V1__baseline.sql** | `purchase_items` | Inventory Intake | `com.tazatokri.purchase.PurchaseItem` |
| **V1__baseline.sql** | `sale_items` | POS / Counter | `com.tazatokri.sales.SaleItem` |
| **V1__baseline.sql** | `stock_movements` | Inventory Ledger | `com.tazatokri.inventory.StockMovement` |
| **V1__baseline.sql** | `vegetable_prices` | Pricing History | `com.tazatokri.pricing.VegetablePrice` |
| **V1__baseline.sql** | `vegetable_units` | Selling Options | `com.tazatokri.catalog.VegetableUnit` |
| **V2__phase2_retention_and_growth.sql** | `notification_preferences` | Marketing / Alerts | `com.tazatokri.notification.NotificationPreference` |
| **V2__phase2_retention_and_growth.sql** | `notification_logs` | Audit Trail | `com.tazatokri.notification.NotificationLog` |
| **V2__phase2_retention_and_growth.sql** | `combos` | Retention Combos | `com.tazatokri.combo.Combo` |
| **V2__phase2_retention_and_growth.sql** | `combo_items` | Retention Combos | `com.tazatokri.combo.ComboItem` |
| **V2__phase2_retention_and_growth.sql** | `saved_baskets` | Recurring Grocery | `com.tazatokri.basket.SavedBasket` |
| **V2__phase2_retention_and_growth.sql** | `saved_basket_items` | Recurring Grocery | `com.tazatokri.basket.SavedBasketItem` |
| **V2__phase2_retention_and_growth.sql** | `recurring_basket_schedules`| Recurring Grocery | `com.tazatokri.basket.RecurringBasketSchedule` |
| **V3__phase3_operations_and_intelligence.sql**| `ai_extraction_logs` | Gemini AI Audit | `com.tazatokri.ai.AiExtractionLog` |
| **V4__phase4_delivery_otp_pod_and_ops.sql** | `delivery_otps` | Security Handshake | `com.tazatokri.delivery.DeliveryOtp` |
| **V4__phase4_delivery_otp_pod_and_ops.sql** | `delivery_evidences` | Proof of Delivery | `com.tazatokri.delivery.DeliveryEvidence` |
| **V4__phase4_delivery_otp_pod_and_ops.sql** | `delivery_audit_logs` | Compliance Trail | `com.tazatokri.delivery.DeliveryAuditLog` |
| **Flyway Internal** | `flyway_schema_history` | Migration Tracking | Managed by Flyway Engine |

**Total Table Count:** **29 tables** (17 from V1 + 7 from V2 + 1 from V3 + 3 from V4 + 1 Flyway history table).

---

## 3. Failure 1: Missing Table `delivery_evidence` (RESOLVED)

### Error Manifestation:
```text
Phase6a2RealMySQLIntegrationTest.java:145
Expected table 'delivery_evidence' to exist after Flyway migration, but was not found.
```

### Root Cause:
The migration `V4__phase4_delivery_otp_pod_and_ops.sql` (Line 39) and `@Entity DeliveryEvidence` (Line 18) define the table name as **`delivery_evidences`** (plural). The test mistakenly looked for singular `delivery_evidence`.

### Status:
**Resolved** in test configuration by updating assertion list to `delivery_evidences` and `delivery_audit_logs`.

---

## 4. Failure 2: Missing `created_at` During Test Insert (RESOLVED)

### Error Manifestation:
```text
Phase6a2RealMySQLIntegrationTest.java:176
java.sql.SQLException: Field 'created_at' doesn't have a default value
```

### Root Cause:
`V1__baseline.sql` defines `created_at datetime(6) NOT NULL` and `updated_at datetime(6) NOT NULL` on `vegetables` without defaults. While `Vegetable.java` always populates them, the test fixture raw SQL omitted both columns.

### Status:
**Resolved** in test configuration by adding `created_at, updated_at` with `NOW(), NOW()`.

---

## 5. Failure 3: SQL Schema Mismatch on `stock_movements` (`Unknown column 'user_id' in 'field list'`)

### Error Manifestation:
```text
Phase6a2RealMySQLIntegrationTest.java:184
java.sql.SQLSyntaxErrorException: Unknown column 'user_id' in 'field list'
    at com.mysql.cj.jdbc.exceptions.SQLError.createSQLException(SQLError.java:121)
    at com.mysql.cj.jdbc.ClientPreparedStatement.executeInternal(ClientPreparedStatement.java:916)
```

### 5.1 Targeted Table and SQL Statement
- **Target Table:** `stock_movements`
- **Failing SQL Statement 1 (Line 184 - Initial Inward):**
  ```sql
  INSERT INTO stock_movements (vegetable_id, type, quantity, reference_type, note, user_id, created_at)
  VALUES (99991, 'PURCHASE', 10.000, 'PURCHASE', 'Initial 10kg Inward', 9991, NOW())
  ```
- **Failing SQL Statement 2 (Line 245 - Concurrent Deductions):**
  ```sql
  INSERT INTO stock_movements (vegetable_id, type, quantity, reference_type, note, user_id, created_at)
  VALUES (99991, 'ONLINE_SALE', -2.000, 'ORDER', 'Concurrent order #X', 9991, NOW())
  ```

### 5.2 Schema Evidence & JPA Entity Mapping
1. **Flyway Migration `V1__baseline.sql` (Lines 205–218):**
   ```sql
   CREATE TABLE `stock_movements` (
     `id` bigint NOT NULL AUTO_INCREMENT,
     `created_at` datetime(6) NOT NULL,
     `created_by` bigint NOT NULL,
     `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     `quantity` decimal(12,3) NOT NULL,
     `reference_id` bigint DEFAULT NULL,
     `reference_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     `type` enum('ADJUSTMENT','ONLINE_CANCEL_RETURN','ONLINE_SALE','PURCHASE','SHOP_SALE','WASTAGE') COLLATE utf8mb4_unicode_ci NOT NULL,
     `vegetable_id` bigint NOT NULL,
     PRIMARY KEY (`id`),
     KEY `idx_stock_veg_created` (`vegetable_id`,`created_at`),
     CONSTRAINT `fk_stock_movements_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
   ```
   **Finding:** The actor column in `stock_movements` is explicitly named **`created_by`**, NOT `user_id`.
2. **JPA Entity `backend/src/main/java/com/tazatokri/inventory/StockMovement.java` (Line 58):**
   ```java
   @Column(nullable = false, updatable = false)
   private Long createdBy;
   ```
   **Finding:** The entity field is `createdBy`, mapping to database column `created_by`.

### 5.3 Why the Test Referenced `user_id`
The test author inadvertently assumed standard foreign key naming (`user_id`) rather than the audit column convention (`created_by`) employed across TazaTokri ledger tables (such as `sales.created_by`, `vegetable_prices.created_by`, and `stock_movements.created_by`).

### 5.4 Comprehensive Audit of Remaining Concurrency SQL Statements
To prevent any subsequent failures, every SQL query in `Phase6a2RealMySQLIntegrationTest.java` was audited against the schema:
1. `DELETE FROM stock_movements WHERE vegetable_id = ?` (Line 167): **Valid** (`vegetable_id` exists).
2. `DELETE FROM vegetables WHERE id = ?` (Line 168): **Valid** (`id` exists).
3. `DELETE FROM categories WHERE id = ?` (Line 169): **Valid** (`id` exists).
4. `DELETE FROM users WHERE id = ?` (Line 170): **Valid** (`id` exists).
5. `INSERT INTO users (id, phone, full_name, password_hash, active, created_at)` (Line 177): **Valid** (all columns exist).
6. `INSERT INTO categories (id, name, active)` (Line 179): **Valid** (all columns exist).
7. `INSERT INTO vegetables (id, name_en, name_mr, name_hi, category_id, base_unit, active, available, created_at, updated_at)` (Line 180): **Valid** (all columns exist and verified in prior run).
8. `SELECT SUM(quantity) FROM stock_movements WHERE vegetable_id = ?` (Line 188): **Valid** (`quantity` and `vegetable_id` exist).
9. `SELECT id FROM vegetables WHERE id = ? FOR UPDATE` (Line 222): **Valid** (`id` exists, tests real InnoDB row lock).
10. `SELECT COALESCE(SUM(quantity), 0) FROM stock_movements WHERE vegetable_id = ?` (Line 231): **Valid** (`quantity` and `vegetable_id` exist).
11. `INSERT INTO stock_movements (vegetable_id, type, quantity, reference_type, note, created_by, created_at)` (Line 245): **Valid** once `user_id` is replaced with `created_by`.
12. Final stock balance assertion `SELECT COALESCE(SUM(quantity), 0) FROM stock_movements WHERE vegetable_id = ?` (Line 275): **Valid**.

**Conclusion:** Once `user_id` is replaced with `created_by` in Lines 184 and 245, there are zero remaining column mismatches in the concurrency test suite.

### 5.5 Classification & Minimal Correction
- **Classification:** **TEST DEFECT** (100%).
- **Minimal Fix:** In `Phase6a2RealMySQLIntegrationTest.java`:
  - Change line 184: `user_id` → `created_by`
  - Change line 245: `user_id` → `created_by`

---

## 6. Risk Assessment & Safety Compliance

| Action | Risk Level | Evaluation & Precautions |
| :--- | :---: | :--- |
| **Modifying Flyway Migrations V1–V4** | **CRITICAL (DO NOT DO)** | Migrations are valid and in sync with production JPA entities. Altering them would break existing deployments. |
| **Altering Column in `stock_movements`** | **CRITICAL (DO NOT DO)** | `created_by` is referenced by `StockMovement.java` and `InventoryService.java`. Renaming it in MySQL would break production code. |
| **Fixing Column Name in Integration Test** | **ZERO RISK** | Corrects test SQL to align with the real production schema without modifying application code or database records. |

---

## 7. Exact Files Proposed for Modification

Only **ONE** file will be modified once approved:
- `backend/src/test/java/com/tazatokri/Phase6a2RealMySQLIntegrationTest.java`

### Specific Line Modifications:
- **Line 184:**
  ```java
  // FROM:
  stmt.executeUpdate("INSERT INTO stock_movements (vegetable_id, type, quantity, reference_type, note, user_id, created_at) "
          + "VALUES (" + testVegId + ", 'PURCHASE', 10.000, 'PURCHASE', 'Initial 10kg Inward', " + testUserId + ", NOW())");
  // TO:
  stmt.executeUpdate("INSERT INTO stock_movements (vegetable_id, type, quantity, reference_type, note, created_by, created_at) "
          + "VALUES (" + testVegId + ", 'PURCHASE', 10.000, 'PURCHASE', 'Initial 10kg Inward', " + testUserId + ", NOW())");
  ```
- **Line 245:**
  ```java
  // FROM:
  stmt.executeUpdate("INSERT INTO stock_movements (vegetable_id, type, quantity, reference_type, note, user_id, created_at) "
          + "VALUES (" + testVegId + ", 'ONLINE_SALE', -" + deductionPerThread + ", 'ORDER', 'Concurrent order #" + threadId + "', " + testUserId + ", NOW())");
  // TO:
  stmt.executeUpdate("INSERT INTO stock_movements (vegetable_id, type, quantity, reference_type, note, created_by, created_at) "
          + "VALUES (" + testVegId + ", 'ONLINE_SALE', -" + deductionPerThread + ", 'ORDER', 'Concurrent order #" + threadId + "', " + testUserId + ", NOW())");
  ```
