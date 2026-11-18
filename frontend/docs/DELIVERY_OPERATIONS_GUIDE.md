# TazaTokri — Delivery Operations Guide

## 1. Delivery Lifecycle

1. **`READY_FOR_DELIVERY` (`OrderStatus.PACKED`):** Order is packed and weighted; appears on the Staff Delivery Dispatch Board (`/staff/orders` -> **Delivery Dispatch Board**).
2. **`ASSIGNED`:** Staff assigns an active `DELIVERY` person (`POST /api/orders/{id}/assign`). Reassigning automatically closes the previous assignment as `UNASSIGNED` and invalidates prior active OTPs.
3. **`OUT_FOR_DELIVERY`:** Delivery driver taps **Start Delivery** (`POST /api/delivery/orders/{id}/start`).
4. **Customer Verification (Mandatory before completion):**
   - **OTP Flow:** Driver taps **Send / Issue 6-Digit OTP** (`POST /api/delivery/orders/{id}/otp/issue`). If WhatsApp Cloud API is enabled, it sends to the customer; otherwise customer shares the code or staff/driver uses the audited manual exception.
   - **Manual Exception Flow:** If the customer has no network or phone access, driver/staff opens the **Audited Exception** drawer, enters a mandatory reason (`>= 10` characters), and submits `POST /api/delivery/orders/{id}/otp/manual-override`, which logs to `delivery_audit_logs`.
5. **Optional Proof of Delivery Photo:** Driver uploads a JPEG, PNG, or WebP photograph (`POST /api/delivery/orders/{id}/proof`) with an optional delivery note.
6. **`DELIVERED`:** Driver collects exact COD amount (if due via `CASH` or `UPI_QR`) and confirms delivery (`POST /api/delivery/orders/{id}/deliver`).
7. **`FAILED` & `RETURNED_TO_STORE`:** If delivery fails, driver records a reason (`POST /api/delivery/orders/{id}/fail`), returning order status to `PACKED`. Staff can then reassign or mark **`RETURNED_TO_STORE`** (`POST /api/orders/{id}/return-to-store`).

---

## 2. Area Grouping & Map Navigation

- Staff can group active deliveries on the Dispatch Board by **PIN code**, **Locality**, or **Assigned Delivery Person**.
- Delivery drivers see customer delivery instructions, a `tel:` call button, and an external Google Maps navigation link using the customer's saved address & PIN code without requiring paid mapping APIs.
