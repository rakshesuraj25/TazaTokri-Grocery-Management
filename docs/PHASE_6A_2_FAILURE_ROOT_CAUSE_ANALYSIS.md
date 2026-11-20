# TazaTokri — Phase 6A.2: Root Cause Analysis of Real MySQL 8.4 Test Failures

**Date:** November 20, 2026  
**Auditor:** Senior Software Architect, Database Specialist, QA Automation Engineer  
**Target Environment:** Real MySQL 8.4.13 on Docker (Port: 3307, Database: `tazatokri_phase6a2_test`)  
**Scope:** Root-cause investigation of test failures encountered during real-infrastructure validation in Windows CMD.  
**Status:** Investigation Complete — Recommendations Documented (No fixes applied yet per instructions).

---

## 1. Executive Summary & Verification Findings

The real MySQL 8.4.13 integration test was executed via Maven from Windows CMD against the isolated disposable database:
- **Host / Port:** `localhost:3307`
- **Database:** `tazatokri_phase6a2_test`
- **Engine:** MySQL Community Server 8.4.13 (Linux/WSL2 Docker container `tazatokri_phase6a2_mysql`)
- **Connection Identity:** Verified exclusively targeting `tazatokri_phase6a2_test`; zero connection to development or production databases.

The execution revealed that Flyway migrations **V1 through V4 completed successfully**, creating exactly **29 tables** in `tazatokri_phase6a2_test`. However, the test stopped due to two specific failures in `Phase6a2RealMySQLIntegrationTest.java`:
1. **Assertion failure at Line 145:** Looking for non-existent table name `delivery_evidence`.
2. **SQL Execution failure at Line 176:** `Field 'created_at' doesn't have a default value` during raw SQL insertion into `vegetables`.

In addition, an audit was conducted on Flyway's migration reporting behavior (`Target Schema Version: null` and `migrationsExecuted = 0`).

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

## 3. Failure 1: Missing Table `delivery_evidence`

### Error Manifestation:
```text
Phase6a2RealMySQLIntegrationTest.java:145
Expected table 'delivery_evidence' to exist after Flyway migration, but was not found.
```

### Detailed Root Cause Analysis:
1. **Migration Definition:**
   In `backend/src/main/resources/db/migration/V4__phase4_delivery_otp_pod_and_ops.sql`, lines 39–41:
   ```sql
   CREATE TABLE IF NOT EXISTS delivery_evidences (
       id BIGINT AUTO_INCREMENT PRIMARY KEY,
       order_id BIGINT NOT NULL,
   ...
   ```
   The migration defines the table in **plural form**: `delivery_evidences`.
2. **JPA Entity Mapping:**
   In `backend/src/main/java/com/tazatokri/delivery/DeliveryEvidence.java`, line 18:
   ```java
   @Entity
   @Table(name = "delivery_evidences",
          uniqueConstraints = @UniqueConstraint(name = "uk_delivery_evidence_key", columnNames = "storage_key"),
          indexes = { ... })
   public class DeliveryEvidence { ... }
   ```
   The entity is explicitly mapped to `@Table(name = "delivery_evidences")`.
3. **Audit Log Table Comparison:**
   Similarly, line 59 of V4 creates `delivery_audit_logs`, matching `@Table(name = "delivery_audit_logs")` in `DeliveryAuditLog.java`.
4. **Integration Test Discrepancy:**
   In `backend/src/test/java/com/tazatokri/Phase6a2RealMySQLIntegrationTest.java`, lines 135–136:
   ```java
   List<String> expectedTables = List.of(
           ...
           "delivery_attempts", "delivery_otps",
           "delivery_evidence", "delivery_audit_log"  <-- Singular forms tested
   );
   ```
   The test expected singular table names (`delivery_evidence` and `delivery_audit_log`) instead of the actual plural table names (`delivery_evidences` and `delivery_audit_logs`).

### Classification:
- **TEST DEFECT** (100%).
- The application architecture, JPA entities, and Flyway V4 migration are completely consistent with plural table naming (`delivery_evidences` and `delivery_audit_logs`).
- No migration or schema changes are needed or permitted.

### Recommended Minimal Fix:
Update line 136 in `Phase6a2RealMySQLIntegrationTest.java` to verify the actual table names:
```java
"delivery_attempts", "delivery_otps",
"delivery_evidences", "delivery_audit_logs"
```

---

## 4. Failure 2: Missing `created_at` During Test Insert

### Error Manifestation:
```text
Phase6a2RealMySQLIntegrationTest.java:176
java.sql.SQLException: Field 'created_at' doesn't have a default value
    at com.mysql.cj.jdbc.exceptions.SQLError.createSQLException(SQLError.java:121)
    at com.mysql.cj.jdbc.ClientPreparedStatement.executeInternal(ClientPreparedStatement.java:916)
```

### Detailed Root Cause Analysis:
1. **DDL Definition in MySQL:**
   In `backend/src/main/resources/db/migration/V1__baseline.sql`, lines 70–86:
   ```sql
   CREATE TABLE `vegetables` (
     `id` bigint NOT NULL AUTO_INCREMENT,
     `active` bit(1) NOT NULL,
     `available` bit(1) NOT NULL,
     `base_unit` enum('BUNCH','KG','PIECE') COLLATE utf8mb4_unicode_ci NOT NULL,
     `created_at` datetime(6) NOT NULL,
     `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     `name_en` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
     `name_hi` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     `name_mr` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     `updated_at` datetime(6) NOT NULL,
     `category_id` bigint NOT NULL,
     PRIMARY KEY (`id`), ...
   ```
   Both `created_at` and `updated_at` are defined as `datetime(6) NOT NULL` **without** a `DEFAULT CURRENT_TIMESTAMP(6)` clause.
2. **MySQL 8.4 Strict Mode:**
   MySQL 8.4 enables `STRICT_TRANS_TABLES` by default. Under strict mode, attempting to insert a row into a table without supplying a value for a `NOT NULL` column that lacks a `DEFAULT` constraint triggers a fatal SQL error (`Field 'created_at' doesn't have a default value`).
3. **Application JPA Entity Behavior:**
   In `backend/src/main/java/com/tazatokri/catalog/Vegetable.java`, lines 64–68:
   ```java
   @Column(nullable = false, updatable = false)
   private LocalDateTime createdAt = LocalDateTime.now();

   @Column(nullable = false)
   private LocalDateTime updatedAt = LocalDateTime.now();
   ```
   In normal application execution via Spring Data JPA (`vegetableRepository.save(v)`), Hibernate generates the insert SQL supplying both `created_at` and `updated_at`.
4. **Integration Test Defect:**
   In `Phase6a2RealMySQLIntegrationTest.java`, lines 176–177:
   ```java
   stmt.executeUpdate("INSERT INTO vegetables (id, name_en, name_mr, name_hi, category_id, base_unit, active, available) "
           + "VALUES (" + testVegId + ", 'Concurrency Test Tomato', 'टोमॅटो', 'टमाटर', 9991, 'KG', 1, 1)");
   ```
   Notice that in lines 173–174 for `users`, the test explicitly provided `created_at`:
   ```java
   stmt.executeUpdate("INSERT INTO users (id, phone, full_name, password_hash, active, created_at) "
           + "VALUES (" + testUserId + ", '9999999991', 'Test Concurrency User', '$2a$10$xyz', 1, NOW())");
   ```
   However, for the `vegetables` insert at line 176, the test omitted both `created_at` and `updated_at`.

### Classification:
- **TEST DEFECT** (100%).
- The test's raw setup SQL failed to supply the mandatory non-null timestamp columns (`created_at`, `updated_at`) that the application JPA layer always provides.

### Recommended Minimal Fix:
Update lines 176–177 in `Phase6a2RealMySQLIntegrationTest.java` to supply `created_at` and `updated_at`:
```java
stmt.executeUpdate("INSERT INTO vegetables (id, name_en, name_mr, name_hi, category_id, base_unit, active, available, created_at, updated_at) "
        + "VALUES (" + testVegId + ", 'Concurrency Test Tomato', 'टोमॅटो', 'टमाटर', 9991, 'KG', 1, 1, NOW(), NOW())");
```

---

## 5. Investigation of Flyway Schema Version & Migration Reporting

### Observation:
- Flyway console output displayed:
  ```text
  Flyway Migrations Executed: 0
  Target Schema Version:      null
  ```
- Yet the database is at version 4, and all 29 tables exist.

### Detailed Root Cause Analysis:
1. **Idempotent Nature of Flyway:**
   When `Phase6a2RealMySQLIntegrationTest` ran the very first time on the empty `tazatokri_phase6a2_test` database, Flyway applied V1, V2, V3, and V4.
   When the test subsequently reached Step 3 and failed on line 176, the database remained populated with the V4 schema and `flyway_schema_history` records.
   On subsequent test runs, Flyway inspected `flyway_schema_history`, determined that all 4 scripts were already applied with checksum matches, and executed `0` new migrations (`migrationsExecuted = 0`).
2. **Flyway Java API Semantics for `MigrateResult.targetSchemaVersion`:**
   In the Flyway Java SDK (`org.flywaydb.core.api.output.MigrateResult`), `migrationResult.targetSchemaVersion` returns the target schema version specified in the configuration, or the target version reached *during that specific migration run*. If no migrations are executed during the invocation, `targetSchemaVersion` is `null`.
3. **Proper API for Current Version Verification:**
   To retrieve and verify the active schema version of the database regardless of whether migrations ran in the current process or a prior run, the test should inspect `flyway.info().current()`:
   ```java
   var current = flyway.info().current();
   assertNotNull(current, "Current schema migration must not be null");
   assertEquals("4", current.getVersion().getVersion(), "Database must be at schema version 4");
   assertEquals(MigrationState.SUCCESS, current.getState());
   ```

### Classification:
- **TEST REPORTING DEFECT** (100%).
- The database schema is fully migrated and healthy at version 4. The test was reading a transient field on `MigrateResult` rather than querying `flyway.info().current()`.

---

## 6. Risk Assessment & Safety Compliance

| Action | Risk Level | Evaluation & Precautions |
| :--- | :---: | :--- |
| **Modifying Flyway Migrations V1–V4** | **CRITICAL (DO NOT DO)** | Migrations are valid, successfully applied, and reflect production design. Modifying them would alter checksums and break existing database instances. |
| **Adding a table `delivery_evidence`** | **HIGH (DO NOT DO)** | Table already exists as `delivery_evidences` and is mapped to `@Entity DeliveryEvidence`. Creating an extra singular table would create duplicate/dead schema artifacts. |
| **Altering `created_at` in MySQL table** | **MEDIUM (DO NOT DO)** | `created_at datetime(6) NOT NULL` is the intended domain model constraint; entities must supply creation timestamps. |
| **Fixing Test Assertion & Raw SQL in Test Class** | **ZERO RISK** | Modifying `Phase6a2RealMySQLIntegrationTest.java` ensures the test accurately reflects the real application schema and constraints without touching production code or database data. |

---

## 7. Exact Files Proposed for Modification

Only **ONE** file needs to be modified once approval is granted:
- `backend/src/test/java/com/tazatokri/Phase6a2RealMySQLIntegrationTest.java`

### Proposed Changes Summary:
1. **Line 113:** Replace `migrationResult.targetSchemaVersion` check with `flyway.info().current().getVersion().getVersion()` verification.
2. **Line 136:** Correct table name assertions from `"delivery_evidence", "delivery_audit_log"` to `"delivery_evidences", "delivery_audit_logs"`.
3. **Line 176:** Add `created_at, updated_at` with `NOW(), NOW()` to the raw SQL `INSERT INTO vegetables`.
