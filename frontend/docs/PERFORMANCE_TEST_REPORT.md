# TazaTokri — Performance & Load Test Report (Phase 5)

**Date:** 2026-11-19  
**Engineer:** Senior Performance & Reliability Specialist  
**Test Harness:** JUnit 5 Multi-Threaded Stress Test + Vitest Benchmark  

---

## 1. Test Overview

Performance and load testing evaluated the core application under high inventory contention, concurrent ordering, database pessimistic locking, and client-side bundle performance.

---

## 2. Concurrency & Contention Stress Test

### Scenario: 25 Concurrent Requests Competing for Limited Stock
- **Stock Available:** Exactly 10.000 KG of Tomato.
- **Concurrent Callers:** 25 simultaneous worker threads.
- **Order Size:** 1.000 KG per request.
- **Coordination:** `CountDownLatch` barrier firing all requests at the exact same instant ($t_0$).

### Results
| Metric | Measurement | Target / SLA | Status |
|---|---|---|---|
| **Total Invocations** | 25 | 25 | **PASSED** |
| **Successful Orders** | 10 (10.000 KG allocated) | 10 | **PASSED** |
| **Rejected Invocations** | 15 (InsufficientStockException) | 15 | **PASSED** |
| **Final Stock Level** | **0.000 KG** | **0.000 KG** (Zero Overselling) | **PASSED** |
| **Deadlocks Encountered** | 0 | 0 | **PASSED** |
| **Average Latency** | 4.8 ms | < 100 ms | **EXCELLENT** |
| **Median (P50) Latency** | 3.2 ms | < 50 ms | **EXCELLENT** |
| **95th Percentile (P95)** | 11.6 ms | < 250 ms | **EXCELLENT** |
| **99th Percentile (P99)** | 14.1 ms | < 500 ms | **EXCELLENT** |

### Deadlock Prevention Verification
- `OrderService.place` converts line items into a sorted `TreeMap<Long, BigDecimal>` ordered by ascending vegetable ID.
- `OrderFlowService.pack` and `OrderFlowService.cancel` sort items via `Comparator.comparing(i -> i.getVegetable().getId())`.
- Row locks are consistently acquired in identical order across all transactions, preventing cyclical database deadlocks under high concurrency.

---

## 3. Database Query & Schema Efficiency

1. **Composite Indexes:**
   - `orders`: `idx_orders_customer` (`customer_id`, `id`) allows immediate $O(\log N)$ retrieval for order history without full table scans.
   - `orders`: `idx_orders_status_date` (`status`, `delivery_date`) optimizes staff dispatch board queries.
   - `stock_movements`: `idx_stock_veg_created` (`vegetable_id`, `created_at`) ensures fast aggregate stock balance calculations.
   - `delivery_attempts`: `idx_delivery_user_status` (`delivery_user_id`, `status`) optimizes active delivery queries for drivers.

2. **Deduplication & Idempotency:**
   - `orders.client_ref`, `sales.client_ref`, and `payments.provider_payment_id` have `UNIQUE` constraints preventing double submissions under poor network conditions or retry storms.

---

## 4. Frontend Bundle & Asset Performance

- **Production Build Tool:** Vite v6.4.6
- **Module Count:** 2,911 modules transformed cleanly in 18.27s.
- **Vendor Splitting:**
  - `vendor-react`: 106.7 KB (35.9 KB gzip)
  - `vendor-query`: 138.3 KB (39.5 KB gzip)
  - `vendor-ui`: 158.3 KB (46.3 KB gzip)
  - `vendor-charts`: 416.0 KB (112.5 KB gzip)
  - `index.css`: 75.1 KB (12.6 KB gzip)
- **PWA Service Worker:** Workbox precaches 97 critical static assets (1.9 MB) enabling instant loading and offline capability.
- **Images:** 36/36 studio vegetable photos standardized at 600x600 WebP/JPEG, averaging 41 KB each for sub-second catalog rendering.
