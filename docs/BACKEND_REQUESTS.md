# Backend Feature & API Requests (`tazatokri-backend`)

Generated during Phase 0 read-only audit against the current `tazatokri-backend` controllers, DTOs, and `src/` frontend usage.
None of these items should be invented or mocked on the frontend; each requires an explicit backend contract before the corresponding UI can be built or completed.

---

## 1. User Management & Authentication

1. **List & Manage Users (`GET /api/users`, `PATCH /api/users/{id}/active`, `PATCH /api/users/{id}/roles`)**
   - **Current state:** `POST /api/auth/register` (`AuthController.java`) creates a user (`OWNER` only), and `GET /api/delivery/people` (`DeliveryAdminController.java`) lists users with `DELIVERY` role only. `UsersPage.tsx` currently can only display delivery personnel and cannot list `OWNER`, `STAFF`, or `CUSTOMER` accounts, edit roles, or deactivate accounts.
   - **Needed:** Paginated/filterable user directory (`id, fullName, phone, email, roles, active, createdAt`) for `OWNER`, plus role update and enable/disable endpoints.
2. **Complete Profile on `GET /api/me` (`PingController.java`)**
   - **Current state:** `GET /api/me` returns `{ phone: string, roles: string }` where `roles` is `auth.getAuthorities().toString()` (e.g. `"[ROLE_OWNER]"`). It omits `userId`, `fullName`, and a JSON array of `Role`.
   - **Needed:** Return `{ userId, fullName, phone, email, roles: Role[] }` (consistent with `LoginResponse` / `UserResponse`) so session rehydration does not rely on stale `localStorage` user metadata.
3. **Password Reset / Change Password (`POST /api/auth/change-password`, forgot-password flow)**
   - **Current state:** `en.json` contains `auth.forgotPassword`, but no reset or password-change endpoint exists in `AuthController.java`.

---

## 2. Public Configuration & Delivery Serviceability

4. **Public Shop & Delivery Rules Config (`GET /api/public/config`)**
   - **Current state:** Minimum order (`150`), delivery fee (`30`), free-delivery threshold (`300`), cutoff time (`18:00`), and serviceable pincodes (`411026,411039`) are configured only in `tazatokri-backend/src/main/resources/application.properties` (`app.delivery.*`). The frontend hardcodes estimates in `src/lib/businessRules.ts` and has no way to validate serviceable pincodes before `POST /api/customer/orders`.
   - **Needed:** Public endpoint returning `{ minOrderAmount, deliveryFee, freeAboveAmount, cutoffTime, serviceablePincodes, onlinePaymentEnabled }`.

---

## 3. Catalog, Categories, Suppliers & Images

5. **Update Vegetable Base Unit & Selling Options (`PUT /api/vegetables/{id}` / unit endpoints)**
   - **Current state:** `VegetableUpdateRequest` (`VegetableUpdateRequest.java`) accepts only `{ nameEn, nameMr, nameHi, imageUrl, categoryId }`. Selling options (`units`) and `baseUnit` cannot be edited after vegetable creation.
6. **Category & Supplier Edit / Deactivate (`PATCH /api/categories/{id}`, `PATCH /api/suppliers/{id}`)**
   - **Current state:** `CategoryController` and `SupplierController` support only `GET` and `POST`; categories and suppliers cannot be renamed or deactivated (`active=false`).
7. **Vegetable Image Upload / Asset Management (`POST /api/vegetables/{id}/image`)**
   - **Current state:** `VegetableRequest` / `VegetableUpdateRequest` only accept an `imageUrl` string (`@Size(max = 500)`). There is no image upload endpoint; `/staff/catalog/images` is read-only and `public/vegetables/` currently has `0 / 36` self-hosted photos.

---

## 4. Customer Addresses, Orders & Online Payments

8. **Address Edit, Delete & Set-Default (`PUT /api/customer/addresses/{id}`, `DELETE /api/customer/addresses/{id}`, `PATCH /api/customer/addresses/{id}/default`)**
   - **Current state:** `CustomerAddressController.java` exposes only `GET` and `POST /api/customer/addresses`. Customers cannot edit, delete, or switch their default address.
9. **Add `baseUnit` to `OrderResponse.Item` (`OrderResponse.java`)**
   - **Current state:** `OrderResponse.Item` returns `{ vegetableId, vegetableName, quantity, unitPrice, estimatedLineTotal, actualQuantity, finalLineTotal }` without `baseUnit` (unlike `DeliveryOrderResponse.Line`, which includes `unit`). As a result, `PackOrderDialog.tsx` and order detail pages cannot display `kg` / `piece` / `bunch` next to quantities.
10. **Order List Item Summaries & Pagination Metadata (`GET /api/customer/orders`, `GET /api/orders`)**
    - **Current state:** `OrderService.list()` calls `OrderResponse.from(o, false)` (returning empty `items: []`) and returns a bare `List<OrderResponse>` (page size 20) with no `totalElements` / `totalPages` / `hasNext`. `CustomerOrdersPage.tsx` cannot display item count/summary on order cards or clean pagination controls.
    - `StaffOrderController.list` has optional `date` and `status` filters, but no pagination, text search, or delivery-partner filter.
11. **Customer Payment & Refund Visibility (`GET /api/customer/orders/{id}/payments`, `expiresAt` on `PENDING_PAYMENT`)**
    - **Current state:** Customers have no read endpoint to inspect payment status, Razorpay reference, or refund state (`PaymentKind.REFUND`), and `OrderResponse` / `PaymentInit` do not include an `expiresAt` timestamp (frontend hardcodes `ONLINE_ORDER_EXPIRY_MINUTES = 15`).
12. **Delivery Tracking Details on Customer Order (`GET /api/customer/orders/{id}`)**
    - **Current state:** Delivery attempts (`GET /api/orders/{id}/deliveries`) are restricted to `OWNER`/`STAFF` (`DeliveryAdminController.java`), so customers with `OUT_FOR_DELIVERY` orders cannot see delivery agent name, phone, or out-for-delivery timestamp.

---

## 5. Payments, Settlements & Refunds (Owner)

13. **Pending Refunds Preview & Settlement History (`GET /api/payments/refunds/pending`, `GET /api/payments/settlements`)**
    - **Current state:** `RefundController.java` only exposes `POST /api/payments/refunds/process` returning `{ refunded: number }`; the Owner cannot preview which cancelled orders have pending refunds before processing, nor browse historical cash settlements after `POST /api/payments/settle`.

---

## 6. Inventory & Reporting

14. **Add `baseUnit` to `DailyReport.ItemLine` & `DailyReport.QtyLine` (`DailyReport.java`)**
    - **Current state:** `DashboardPage.tsx` top items, wastage, and stock lists receive raw numeric quantities without `baseUnit`, so mixed units (`KG`, `BUNCH`, `PIECE`) appear unitless.
15. **Low-Stock Threshold Configuration & Global Stock Movement Feed**
    - **Current state:** `InventoryController.java` only provides per-vegetable `GET /api/inventory/stock/{id}/movements`. Frontend hardcodes `<= 5` as the low-stock threshold in `StockPage.tsx` and `QuickSaleTile.tsx`, and there is no cross-catalog recent movement / wastage log endpoint.
16. **Date-Range Analytics Report & Export (`GET /api/reports/range`)**
    - **Current state:** `ReportController.java` supports only single-day `GET /api/reports/daily?date=...`. Weekly/monthly revenue, margin/profit comparison, and CSV export require backend support.

---

## Out-of-Scope on Frontend (Blocked Until Backend Support Exists)

The following items were explicitly left unimplemented / excluded from client workarounds so the frontend never invents endpoints, fields, or mutable business state:

- **Switch payment method after `PENDING_PAYMENT` online failure** — No `PATCH /api/customer/orders/{id}/payment-method` endpoint exists; frontend disables `ONLINE` checkout cleanly on `400 Online payment is not available` and preserves COD.
- **Account password change / forgot-password flow** — No backend endpoint exists in `AuthController.java`.
- **Edit or delete customer saved addresses / switch default** — `CustomerAddressController.java` only exposes `GET` and `POST`.
- **Edit existing user roles, activate/deactivate accounts, or list non-delivery staff** — `UsersPage` shows the register form (`POST /api/auth/register`) and delivery personnel (`GET /api/delivery/people`); full directory & edits require new endpoints.
- **Display units on `PackOrderDialog` / `OrderResponse.Item` and `DailyReport` top items** — Waiting for `baseUnit` on `OrderResponse.Item` and `DailyReport` quantity lines (`DailyReport` stock panel pairs against `/api/staff/catalog` for display where available).
- **Customer-facing rider tracking & refund status detail** — `GET /api/orders/{id}/deliveries` and payment records are `OWNER`/`STAFF` only.
- **Pending refund preview list & historical cash settlement ledger** — Only aggregate `POST /api/payments/refunds/process` (`{ refunded }`) and `GET /api/payments/cash-pending` exist today.
- **Server-driven business rules & multi-day P&L / margin reports** — Min order (`150`), fee (`30`), free-delivery threshold (`300`), `18:00` IST cutoff, `15 min` hold, and low-stock threshold (`5`) live in `src/lib/businessRules.ts` until `GET /api/public/config` is added.
