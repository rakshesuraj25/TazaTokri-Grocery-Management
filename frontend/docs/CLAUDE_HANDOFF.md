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

## 4. Phase 1 & Phase 2 Completion Status

1. **COMPLETE — 36/36 Studio Vegetable Photographs:** All 36 `600x600` JPEG (`< 80 KB`) studio photographs on `#FAF8F2` are installed in `frontend/public/vegetables/<slug>.jpg` and verified via `npm run check:images`.
2. **COMPLETE — Phase 1 Stabilization & Search:** Multilingual Marathi/Hindi/phonetic search (`src/data/vegetable-synonyms.ts`, `src/utils/vegetable-search.ts`), customer stock capping (`availableStock`), configurable low-stock thresholds, daily/weekly wastage reports (`GET /api/reports/wastage`), and printable A4/thermal Quick Sale receipts are implemented and tested (`86/86` frontend tests, `6/6` backend JUnit suites).
3. **COMPLETE — Phase 2 Retention & Growth:** Flyway migration `V2__phase2_retention_and_growth.sql`, WhatsApp notification preferences & templates (`EN`/`MR`/`HI`), optional WhatsApp Business Cloud API provider, Staff & Customer Combo Packs (`/staff/combos`, `/api/public/combos`), and Saved & Recurring Grocery Baskets (`/api/my/baskets`) are implemented and verified. See [`docs/PHASE_2_IMPLEMENTATION_REPORT.md`](./PHASE_2_IMPLEMENTATION_REPORT.md) for full details.
4. **COMPLETE — Phase 3 Shop Operations & Business Intelligence:** Flyway migration `V3__phase3_operations_and_intelligence.sql` (`ai_extraction_logs`), `58mm`/`80mm`/`A4` thermal receipt printing (`SaleReceiptDialog.tsx`, `CustomerOrderReceiptDialog.tsx`), Inventory Intelligence & Profitability reporting (`GET /api/reports/intelligence`, `BusinessIntelligencePanel.tsx`), Freshness Batch tracking & Staff Markdown Clearance pricing (`POST /api/pricing/vegetables/{id}/markdown`, `MarkdownPriceDialog.tsx`), and Gemini AI Purchase Invoice & Quick Sale Customer List Draft Assistants (`com.tazatokri.ai`, `InvoiceScannerCard.tsx`, `AiQuickSaleAssistantDialog.tsx`) are implemented and verified. See [`docs/PHASE_3_IMPLEMENTATION_REPORT.md`](./PHASE_3_IMPLEMENTATION_REPORT.md) for full details.
5. **COMPLETE — Phase 4 Production Readiness & Delivery Management:** Flyway migration `V4__phase4_delivery_otp_pod_and_ops.sql`, Staff Delivery Dispatch & Area Grouping (`GET /api/delivery/admin/board`), BCrypt-hashed 6-digit Delivery OTP verification & audited manual exceptions, magic-byte-validated Proof of Delivery photo storage (`ProofStorageProvider`), Spring Boot Actuator health probes + `/api/ops/health` + scrubbed optional Sentry monitoring (`LogScrubber`, `sentry.ts`), MySQL backup & isolated restore scripts (`scripts/backup-mysql.*`, `scripts/restore-mysql-test.*`), Playwright E2E flows (`tests/e2e/critical-flows.spec.ts`), and hardened CI/CD & Dockerfiles are implemented and verified. See [`docs/PHASE_4_IMPLEMENTATION_REPORT.md`](./PHASE_4_IMPLEMENTATION_REPORT.md) for full details.
