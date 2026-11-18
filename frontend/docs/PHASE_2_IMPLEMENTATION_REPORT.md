# TazaTokri — Phase 2 Implementation Report: Customer Retention & Sales Growth

## 1. Executive Summary

Phase 2 introduces customer retention, repeat-purchase convenience, order communication, and value combo packs across the TazaTokri full-stack application while preserving all Phase 1 capabilities and business rules:
- Minimum order: ₹150
- Delivery fee: ₹30 (Free delivery for orders `>= ₹300`)
- Order cutoff: 6 PM IST
- Online payment hold: 15 minutes
- 36 verified studio vegetable photographs (`600x600` JPEG `< 80 KB`)

---

## 2. Database Migration (`V2__phase2_retention_and_growth.sql`)

Location: `backend/src/main/resources/db/migration/V2__phase2_retention_and_growth.sql`

Creates 6 new tables (non-destructive, preserving all existing data):
1. `notification_preferences`: Stores per-user explicit WhatsApp consent (`whatsapp_opt_in`, default `0`), `consent_timestamp`, and `preferred_language` (`EN`, `MR`, `HI`).
2. `notification_logs`: Records order notification events (`ORDER_PLACED`, `ORDER_CONFIRMED`, `ORDER_PACKED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`) with a unique constraint `uk_notification_order_event_channel (order_id, event_type, channel)` preventing duplicate notifications.
3. `combos`: Stores staff-managed vegetable combo packs (`name_en`, `name_mr`, `name_hi`, descriptions, `selling_price`, `active`, `available`).
4. `combo_items`: Maps constituent vegetables (`vegetable_id`, `unit_label`, `quantity_in_base_unit`) to each combo with foreign-key constraints.
5. `saved_baskets` & `saved_basket_items`: Stores customer-owned named grocery baskets and their vegetable/unit lines.
6. `recurring_basket_schedules`: Stores customer-owned recurring reminder schedules (`DAILY`, `WEEKLY`, `CUSTOM_WEEKDAY`, `BIWEEKLY`) with `status` (`ACTIVE`, `PAUSED`, `CANCELLED`) and `next_reminder_date` in IST.

---

## 3. New Backend Modules & API Endpoints

### A. WhatsApp Customer Communication (`com.tazatokri.notification`)
- `GET /api/my/notifications/preferences` — Customer fetches their WhatsApp opt-in status, consent timestamp, and preferred language (`EN` / `MR` / `HI`).
- `PUT /api/my/notifications/preferences` — Customer updates WhatsApp opt-in/opt-out consent and preferred language.
- `GET /api/my/orders/{orderId}/whatsapp-share` — Generates a prefilled `wa.me` share link and store support link for the customer's own order.
- `POST /api/orders/{orderId}/notifications/{eventType}` (`OWNER`, `STAFF`, `DELIVERY`) — Validates order status transition, checks customer consent, prevents duplicate notification events, optionally dispatches via WhatsApp Business Cloud API when enabled, and returns the prefilled `wa.me` URL.
- `GET /api/orders/{orderId}/notifications` (`OWNER`, `STAFF`) — Lists notification log history for an order.

### B. Vegetable Combo Packs (`com.tazatokri.combo` & `OrderService`)
- `GET /api/public/combos` — Returns active combos with constituent items, authoritative regular combined price, combo selling price, savings amount, `inStock`, and `maxAvailableCombos`.
- `GET /api/staff/combos` (`OWNER`, `STAFF`) — Lists all combos for staff management.
- `POST /api/staff/combos` (`OWNER`, `STAFF`) — Creates a new combo pack (validates >= 2 distinct active vegetables and positive selling price).
- `PUT /api/staff/combos/{id}` (`OWNER`, `STAFF`) — Updates an existing combo pack.
- `PATCH /api/staff/combos/{id}/available` & `PATCH /api/staff/combos/{id}/active` (`OWNER`, `STAFF`) — Toggles daily availability or active status.
- `POST /api/staff/combos/seed-defaults` (`OWNER`, `STAFF`) — Idempotently seeds the 3 starter combos (*Daily Cooking Combo*, *Healthy Green Combo*, *Family Kitchen Combo*).
- `POST /api/my/orders` (`PlaceOrderRequest`) — Extended to accept `combos: [{ comboId, count }]`:
  - Validates combo active/available status and constituent vegetable stock.
  - Allocates the combo selling price snapshot across constituent `OrderItem`s so historical orders are never altered by future combo price changes.
  - Deducts constituent vegetable stock once in sorted ID order via pessimistic locking.

### C. Saved & Recurring Grocery Baskets (`com.tazatokri.basket`)
- `GET /api/my/baskets` — Lists customer's saved baskets with live availability, `unavailableItems` warnings, and schedule metadata.
- `GET /api/my/baskets/reminders` — Lists active recurring baskets whose reminder is due today in IST.
- `POST /api/my/baskets`, `PUT /api/my/baskets/{id}`, `DELETE /api/my/baskets/{id}` — Create, edit, and delete customer-owned baskets.
- `PUT /api/my/baskets/{id}/schedule`, `POST /api/my/baskets/{id}/schedule/pause`, `POST /api/my/baskets/{id}/schedule/resume`, `DELETE /api/my/baskets/{id}/schedule` — Configure, pause, resume, or cancel recurring reminders.

---

## 4. WhatsApp Business Cloud API Setup & Dependencies

Stage 1 (`wa.me` manual sharing) works out of the box with zero external credentials.
Stage 2 (Official Meta WhatsApp Business Cloud API) is disabled by default (`WHATSAPP_ENABLED=false`) and can be enabled via environment variables:

```properties
WHATSAPP_ENABLED=true
WHATSAPP_PHONE_NUMBER_ID=<your-meta-phone-number-id>
WHATSAPP_ACCESS_TOKEN=<your-meta-system-user-access-token>
WHATSAPP_BUSINESS_ACCOUNT_ID=<your-waba-id>
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<your-webhook-verify-token>
WHATSAPP_SHOP_SUPPORT_PHONE=9999999999
```

**Important Consent & Template Requirements:**
- Providing a phone number during signup does **not** grant WhatsApp consent; `whatsapp_opt_in` defaults to `false` until the customer explicitly opts in on `/shop/account`.
- Production business-initiated messages outside the 24-hour service window require Meta-approved templates in the WhatsApp Business Manager matching the 6 order events.

---

## 5. Tests Executed

| Suite | Command | Result |
|---|---|---|
| **Frontend Typecheck** | `cd frontend && npm run typecheck` | **PASSED** (`0` errors) |
| **Frontend ESLint** | `cd frontend && npm run lint` | **PASSED** (`0` warnings) |
| **Frontend Vitest Suite** | `cd frontend && npm test` | **PASSED** (`18` test files, `86/86` tests) |
| **Frontend Production Build** | `cd frontend && npm run build` | **PASSED** (`94` precached PWA assets) |
| **Backend Maven JUnit Suite** | `cd backend && .\mvnw.cmd test` | **PASSED** (`6/6` test suites in `TazatokriBackendApplicationTests`) |
