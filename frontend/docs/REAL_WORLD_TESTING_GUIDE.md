# TazaTokri — Real-World Shop Scenario Testing Guide (Phase 5)

This guide documents the end-to-end verification of TazaTokri against 10 real-world vegetable retail business scenarios.

---

## Scenario A — Normal Customer Order to Doorstep Delivery

1. **Customer Action:** Logs in as Customer (`9888888888`), searches "टोमॅटो" or "Tomato", adds 2 kg Tomato (₹80) + 2 kg Onion (₹100) = ₹180 subtotal.
2. **Business Rule Check:** Subtotal >= ₹150 minimum order requirement. Delivery fee of ₹30 is applied. Total = ₹210.
3. **Checkout:** Selects address in Pune serviceable PIN code (`411026`), adds delivery instruction "Leave with security guard", selects COD, clicks "Place Order".
4. **Staff Workflow:** Staff views order on dispatch board, accepts, packs actual weighed vegetables, status becomes `PACKED`.
5. **Delivery Workflow:** Assigned to Delivery Driver (`9222222222`). Driver starts delivery (`OUT_FOR_DELIVERY`), requests 6-digit OTP, enters OTP verified at doorstep, records cash collection of ₹210.
6. **Expected Outcome:** Order marked `DELIVERED`, cash settlement queued for Owner reconciliation.

---

## Scenario B — Out of Stock Protection

1. **Customer Action:** Attempts to add 15 kg of Spinach when inventory ledger records only 4 kg available.
2. **Expected Frontend Behavior:** Quantity selector caps at 4 kg. Badge displays "Only 4 kg left".
3. **Expected Backend Behavior:** If customer bypasses client and posts 15 kg, `OrderService.place` throws `InsufficientStockException("Only 4 KG of Spinach in stock")`. Stock remains completely unchanged.

---

## Scenario C — Concurrent Ordering Contention

1. **Scenario:** 25 customers attempt to checkout the last 10 kg of vegetables simultaneously.
2. **Expected Behavior:** Pessimistic lock (`findByIdForUpdate`) queues requests. Exactly 10 requests succeed. The remaining 15 requests fail gracefully with HTTP 409 `InsufficientStockException`. Final inventory ledger is exactly 0.000 KG (never negative).

---

## Scenario D — Order Cancellation & Stock Restoration

1. **Customer Action:** Cancels an order before packing cutoff (`PLACED` or `CONFIRMED` status).
2. **Expected Behavior:** Status transitions to `CANCELLED`. Inventory service appends an `ONLINE_CANCEL_RETURN` ledger entry with exact positive quantity. Stock is restored immediately.
3. **Tamper Test:** Customer attempts to cancel the same order again. Backend rejects with `InvalidOrderStateException`. Zero double stock addition.

---

## Scenario E — Delivery Failure & Stock Protection

1. **Scenario:** Driver arrives at customer address, customer is unavailable or address is locked.
2. **Driver Action:** Driver enters failure reason "Customer unavailable, phone switched off" and clicks "Mark Failed".
3. **Expected Behavior:** Delivery attempt status becomes `FAILED`. Order returns to `PACKED` state. Stock is NOT returned to shelf yet (vegetables remain packed in customer basket). Audit log records driver ID, timestamp, and failure reason.

---

## Scenario F — Quick Sale Counter POS

1. **Staff Action:** Customer buys 1.5 kg Onion + 0.5 kg Green Chilli at shop counter. Staff enters weights on Quick Sale screen, selects UPI QR payment, clicks "Complete Sale".
2. **Expected Behavior:** Stock deducted immediately via `SHOP_SALE` movement. Sale record created with unique `client_ref`. Printable thermal receipt generated (58mm/80mm format).

---

## Scenario G — Wholesale Purchase Inward

1. **Staff Action:** Records wholesale arrival: 50 kg Onion @ ₹25/kg + 30 kg Potato @ ₹20/kg from Mandi supplier.
2. **Expected Behavior:** `purchases` record saved. Inventory movements of type `PURCHASE` credit stock immediately. Landed cost calculated factoring in transport.

---

## Scenario H — Wastage Recording

1. **Staff Action:** Records 3.5 kg of damaged tomatoes with reason "Spoiled / Rotted".
2. **Expected Behavior:** Stock reduced via `WASTAGE` movement. Note formatted as "Spoiled / Rotted". If staff tries to record wastage exceeding available stock, transaction is rejected. Wastage report updates financial loss metrics.

---

## Scenario I — Online Payment Timeout / Expiry

1. **Customer Action:** Initiates Razorpay payment for an order but closes browser or payment gateway expires after 15 minutes.
2. **Expected Behavior:** Scheduled job or subsequent check detects expiration. Order status set to `CANCELLED`. Stock reservation is released. If Razorpay webhook arrives late for an expired order, refund is queued automatically.

---

## Scenario J — Backup Disaster Recovery

1. **Operator Action:** Runs `powershell -ExecutionPolicy Bypass -File .\scripts\restore-mysql-test.ps1`.
2. **Expected Behavior:** Script verifies SHA-256 integrity, structural table definitions, and restores to isolated database `tazatokri_restore_test` with zero production impact.
