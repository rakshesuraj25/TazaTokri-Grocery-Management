# TazaTokri Claude Handoff (`CLAUDE_HANDOFF.md`)

Concise handoff for continuing TazaTokri frontend & full-stack launch readiness.

---

## 1. Repository & Contract Rules

- **Backend Isolation:** `tazatokri-backend/` (Java / Spring Boot / MySQL / Flyway) is **read-only** for frontend work. Never run SQL resets or `POST /api/vegetables/seed-catalog`.
- **Exact Enums:**
  - `DeliveryStatus`: `ASSIGNED | OUT_FOR_DELIVERY | DELIVERED | FAILED | UNASSIGNED`
  - `PaymentMethod`: `CASH | UPI_QR | RAZORPAY`
  - `PaymentStatus`: `PENDING | SUCCESS | FAILED`
  - `PaymentKind`: `COLLECTION | REFUND`
  - `OrderStatus`: `PENDING_PAYMENT | PLACED | CONFIRMED | PACKED | OUT_FOR_DELIVERY | DELIVERED | CANCELLED`
- **Business Rules (`src/lib/businessRules.ts`):** Min order `₹150`, delivery fee `₹30`, free delivery from `₹300`, cutoff `18:00` IST (after 6 PM -> next day), online payment hold `15` minutes, weight-based final billing calculated on server (`decimal.js` on frontend labelled `"Estimated"`).
- **Auth & Idempotency:** JWT lives solely in `localStorage['token']`; `useMe()` parses `/api/me` roles defensively. `createClientRef()` (`src/lib/idempotency.ts`) preserves `clientRef` across failed retries in `useCartStore` and `QuickSalePage`.

---

## 2. Architecture & Newly Added Primitives

- **Router (`src/app/router.tsx`):** `/` & `/shop` (`CustomerLayout`), `/login` & `/signup` (`PublicLayout`), `/shop/{checkout,orders,orders/:id,account}`, `/staff/{dashboard,sale,orders,stock,catalog,catalog/new,catalog/:id,catalog/images,categories,suppliers,purchases,purchases/new,purchases/:id,pricing,payments,users}`, `/delivery`, `/display/prices`, dev `/dev/styleguide`.
- **Staff Navigation (`StaffLayout.tsx`):** Collapsible desktop sidebar (`localStorage['tazatokri.sidebar.collapsed']`), tablet compact sidebar at `md:` (`768px`), mobile left slide-out drawer (`Sheet side="left"`), tooltips via `src/components/ui/tooltip.tsx`, grouped under `Today`, `Sell`, `Products`, `Buy`, `Orders`, `Money`, `Team`.
- **Shared Primitives (`src/components/`):** `PageHeader` (breadcrumbs supported), `Stat`, `DataTable`, `SectionHeader`, `WeaveDivider`, `ProductCard` / `VegetableCard`, `PriceTag`, `StatusBadge` (always icon + text), `StockMeter`, `EmptyState`, `ErrorState`, `Skeletons`, `VegetableImage`, `VegetablePlaceholder`.

---

## 3. Exact Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run check:images
npm run test:e2e
```

---

## 4. Remaining Work Before Production Launch

1. **BLOCKED — Real Vegetable Photos (`0 / 36`):** External network image fetching is unavailable inside the offline sandbox. Add approved `600x600` MozJPEG (`<= 80 KB`) photographs to `public/vegetables/<slug>.jpg`, record `Source` + `Licence` in [`docs/IMAGES.md`](./IMAGES.md) & [`docs/IMAGE_SOURCES.md`](./IMAGE_SOURCES.md), and validate with `npm run check:images`.
2. **NOT TESTED — Live Full-Stack E2E & Payments:** Start `tazatokri-backend` locally with dev database credentials/pincodes configured, then run `npm run test:e2e` across Login, Shop, Checkout, Confirm, Pack, Assign, Deliver, COD Settlement, Pricing, Stock, and Quick Sale.
3. **Human Translation Review:** Walk through `525` EN/MR/HI keys (`docs/I18N_REVIEW.md`) with a local store operator.
