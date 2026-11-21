# TazaTokri — End-to-End Smoke Test Checklist

Mark each item `[PASS]` / `[FAIL]` during staging validation before production sign-off.

| # | Flow | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| 1 | Owner login | Sign in on `/login` with `OWNER` credentials | Redirected to `/staff/dashboard`; owner-only nav items visible | [ ] |
| 2 | Staff login & permissions | Sign in as `STAFF`; attempt `/staff/reports`, `/staff/suppliers`, `/staff/backups` | Staff views allowed; `OWNER`-only routes blocked (`403` / Forbidden) | [ ] |
| 3 | Customer registration/login | Register new customer on `/signup`, then log out and log in on `/login` | Customer account created with `CUSTOMER` role; JWT issued; `/shop` accessible | [ ] |
| 4 | Browse catalog | Open `/shop`, filter by category, search vegetables | Active available vegetables render with current prices and stock status | [ ] |
| 5 | Add/remove cart items | Add vegetables/combos, adjust quantities, remove an item | Cart subtotal and item counts update accurately; persisted in local state | [ ] |
| 6 | Checkout min-order validation | Attempt checkout below configured `minOrder` | Checkout blocked with clear minimum-order error message | [ ] |
| 7 | PIN-code validation | Select/add address with unserviceable PIN vs serviceable PIN | Unserviceable PIN blocked; serviceable PIN allowed | [ ] |
| 8 | COD order | Place COD order above `minOrder` | Order created as `PLACED`; stock reduced; idempotent `clientRef` prevents duplicates | [ ] |
| 9 | Online payment success | Place `ONLINE` order (`PENDING_PAYMENT`), complete Razorpay payment | Signature verified; order transitions to `PLACED`; `Payment` marked `SUCCESS` | [ ] |
| 10 | Payment failure & expiry | Create `ONLINE` order without paying; wait for expiry job | Order expires to `CANCELLED`; stock restored; promo redemption released | [ ] |
| 11 | Order cancellation & stock restoration | Cancel `PLACED` order as customer or staff | Status becomes `CANCELLED`; stock restored (`ONLINE_CANCEL_RETURN`); loyalty reversed; promo released | [ ] |
| 12 | POS cash sale | Record cash sale in `/staff/quick-sale` | `Sale` persisted; stock reduced (`SHOP_SALE`); reflected in Cash Closing | [ ] |
| 13 | POS UPI sale | Record UPI sale in `/staff/quick-sale` | `Sale` persisted with `UPI`; stock reduced; reflected in Business Reports UPI totals | [ ] |
| 14 | Purchase & stock addition | Create multi-item purchase in `/staff/purchases/new` with invoice # | Purchase `COMPLETED`; stock increased (`PURCHASE`); retry with same `idempotencyKey` does not duplicate stock | [ ] |
| 15 | Supplier payment | Record partial payment on `/staff/suppliers/:id`, attempt overpayment, then settle remaining | Partial payment reduces `outstandingPayable`; overpayment rejected (`400`); full payment marks purchase `PAID` | [ ] |
| 16 | Rider assignment & delivery | Assign order to `DELIVERY` rider; verify OTP / mark delivered in `/staff/delivery` | Delivery attempt tracked; order transitions to `DELIVERED`; COD collected recorded | [ ] |
| 17 | COD settlement | Settle rider COD cash in `/staff/payments` / `/staff/riders` | `codSettledToShop` increases; `codPendingSettlement` decreases | [ ] |
| 18 | Cash closing | Open `/staff/cash-closing`, review live totals, submit closing | Matches POS cash, COD settled, refunds, and purchase spend | [ ] |
| 19 | Loyalty points | Deliver eligible order, verify points earned on `/account/loyalty`; redeem points at checkout | `EARN` ledger entry created (excluding delivery fee); `REDEEM` reduces payable without double-counting | [ ] |
| 20 | Promo redemption & release | Apply single-use promo at checkout, cancel order, then re-apply on new order | First order consumes promo; cancellation releases redemption so customer can reuse it | [ ] |
| 21 | Reports | Open `/staff/reports` and `/staff/dashboard` | KPIs, daily trends, payment breakdown, and overview match persisted transactions | [ ] |
| 22 | Inventory insights | Open `/staff/inventory-insights`, switch 3 / 7 / 14 days | Stockout risk, trends, and advisory purchase quantities update per horizon | [ ] |
| 23 | Backup creation & verification | Create manual backup on `/staff/backups`, click `Verify` | `.zip` created in `APP_BACKUP_DIR`; `COMPLETED` + `VERIFIED` with `SHA-256` checksum | [ ] |
| 24 | Backup download authorization | Download verified backup as `OWNER`; attempt download as `STAFF`/`CUSTOMER` | `OWNER` downloads valid `.zip`; non-`OWNER` receives `403`; invalid IDs rejected | [ ] |
