# TazaTokri UI Redesign Report (`TAZATOKRI_UI_REDESIGN_REPORT.md`)

**Execution Mode:** Single-pass frontend-only visual and structural redesign (no commits created, `tazatokri-backend/` untouched).

---

## 1. Verification Matrix

| Item | Status | Evidence |
|---|---|---|
| TypeScript check (`npm run typecheck`) | **PASS** | `tsc --noEmit` exited with code `0` (`task-3620`) |
| ESLint check (`npm run lint`) | **PASS** | `eslint . --max-warnings 0` exited with code `0` (`task-3620`) |
| Unit & integration tests (`npm test`) | **PASS** | `vitest run` — **13 test files, 63 tests passed** (`0` failures, `task-3620`), including new `src/tests/redesign2Helpers.test.tsx` (sort, EN/MR/HI search, cart pruning, dashboard attention items, primitives, 4-tab mobile nav, catalog status filters) |
| Production build (`npm run build`) | **PASS** | `tsc -b && vite build` exited with code `0` (`17.08s`, PWA `85` precache entries, `task-3620`) |
| Image pipeline check (`npm run check:images`) | **PASS** | `node scripts/check-images.mjs` exited with code `0` (`0 / 36` photos present; per-slug SVG illustrations active) |
| Headless Chrome screenshots & responsive check (`docs/screens/redesign-2/`) | **PASS** | **44 / 44** captures (`landing`, `shop`, `chalkboard`, `quicksale`, `catalog`, `pricing`, `stock`, `dashboard`, `orders`, `delivery`, `login` × `360px`, `390px`, `768px`, `1440px`) completed with **`0` horizontal overflows**, **`0` broken images**, **`0` JS page errors** (`task-3624`), visually spot-checked `shop-360.png`, `shop-1440.png`, `quicksale-1440.png`, `catalog-360.png`, `catalog-1440.png`, `chalkboard-1440.png` |
| Full-stack e2e flow against live Spring Boot server (`npx playwright test`) | **NOT TESTED** | `tazatokri-backend` was not started and TCP port binding / Playwright browser binary cache is outside this sandbox |
| Lighthouse score | **NOT TESTED** | Lighthouse was not executed in this environment |
| Real 36-vegetable JPEG photographs (`public/vegetables/*.jpg`) | **NOT TESTED** (`0 / 36` present) | None present by design (`public/vegetables/` remains `0 / 36`; per-slug SVG illustrations render safely) |

---

## 2. Files Added, Modified & Deleted

### Added Files
- `docs/REDESIGN_PLAN.md` — Audit of generic patterns and target structure
- `docs/TAZATOKRI_UI_REDESIGN_REPORT.md` — Final verification & handoff report
- `docs/screens/redesign-2/*.png` — `44` viewport captures (`360px`, `390px`, `768px`, `1440px`)
- `src/components/PageHeader.tsx` — Unified header primitive (`h1`, subtitle, count, weave accent, actions)
- `src/components/WeaveDivider.tsx` — Woven-tokri SVG motif hairline divider (`subtle` & `chalkboard` variants)
- `src/components/ProductCard.tsx` — Canonical shared export aliasing `VegetableCard`
- `src/features/catalog/components/ShopHero.tsx` — Editorial storefront hero (`Freshness for every home`, IST cutoff & delivery rules)
- `src/features/catalog/components/ShopToolbar.tsx` — Sticky search (EN/MR/HI) + client-side sort + category pill rail
- `src/features/catalog/components/ShopTrustFooter.tsx` — Trust pillars (`Picked fresh`, `Pay for actual weight`, `Cash or UPI on delivery`) + footer
- `src/features/catalog/components/CatalogToolbar.tsx` — Search + category dots + status filter pills (`All`, `Available today`, `Out of stock`, `No price`)
- `src/features/catalog/components/CatalogCardsGrid.tsx` — Responsive grid/compact mobile cards with `StockMeter`
- `src/features/catalog/components/CatalogImportDialog.tsx` — Default catalog import confirmation modal
- `src/features/orders/components/CheckoutSteps.tsx` — Extracted `CheckoutStepBar`, `CheckoutAddressStep`, `CheckoutPaymentStep`, `CheckoutSummaryCard`
- `src/features/orders/components/StaffOrderCard.tsx` — Hairline-separated order card for `/staff/orders`
- `src/features/sales/useQuickSaleController.ts` — Extracted Quick Sale state/mutations/idempotent `clientRef` hook
- `src/features/sales/components/QuickSaleCatalogPanel.tsx` — Quick Sale search, category pills & tile grid
- `src/features/inventory/components/StockToolbar.tsx` — Stock search, sort & status pills
- `src/features/inventory/components/StockListView.tsx` — Stock card & table views
- `src/features/report/dashboardHelpers.ts` — Pure `buildDashboardAttentionItems` helper (stock, unpriced, waiting orders, cash, cancelled online refunds, photos)
- `src/features/report/components/DashboardOperationalCards.tsx` — Stock alert summary, cash settlements/refunds CTA & image readiness card
- `src/features/report/components/DashboardCharts.tsx` — Recharts `Top items` (capped `maxBarSize={24}`), `Payment split`, `Wastage`, and `Current stock` cards
- `src/features/delivery/components/DeliveryOrderCard.tsx` — Phone-first delivery card (`Collect ₹X` / `Prepaid`, tap-to-call, Maps, Start/Deliver/Fail)
- `src/tests/redesign2Helpers.test.tsx` — 7 unit/integration tests for sorting, search, cart pruning, needs-attention items, primitives, customer bottom nav, and catalog filters

### Modified Files
- `src/styles/globals.css`, `src/components/ui/card.tsx` — `16px` (`--radius: 1rem`) radius, layered shadows, mobile `16px` body font-size
- `src/components/StatusBadge.tsx` — Added semantic icons alongside all status labels (never colour alone)
- `src/components/EmptyState.tsx`, `src/components/SectionHeader.tsx` — Integrated `WeaveDivider` support
- `src/app/router.tsx`, `src/features/landing/pages/LandingPage.tsx`, `src/features/catalog/pages/ShopPage.tsx` — Unified `/` and `/shop` into one editorial customer storefront
- `src/components/layout/CustomerLayout.tsx` — Header (`Logo`, nav, `RoleSwitcher`, `LanguageSwitcher`, live `Cart`) + 4-item mobile bottom nav (`Shop`, `My Orders`, `Cart`, `Log in` / `Account`)
- `src/components/layout/StaffLayout.tsx` — Grouped desktop & mobile-sheet navigation under `Today`, `Sell`, `Products`, `Buy`, `Orders`, `Money`, `Team`
- `src/features/catalog/shopHelpers.ts`, `src/features/catalog/components/VegetableCard.tsx` — Added `sortPublicVegetables` and edge-free `1:1` category wash card hierarchy with prominent base-unit pricing
- `src/features/catalog/pages/CatalogPage.tsx`, `src/features/sales/pages/QuickSalePage.tsx`, `src/features/sales/components/QuickSaleTile.tsx`, `src/features/inventory/pages/StockPage.tsx`, `src/features/orders/pages/CheckoutPage.tsx`, `src/features/orders/pages/CustomerOrderDetailPage.tsx`, `src/features/orders/pages/StaffOrdersPage.tsx`, `src/features/report/pages/DashboardPage.tsx`, `src/features/delivery/pages/DeliveryOrdersPage.tsx`, `src/features/pricing/pages/PricingPage.tsx`, `src/features/pricing/pages/ChalkboardPriceBoardPage.tsx`, `src/features/payments/pages/PaymentsPage.tsx`, `src/pages/StyleGuidePage.tsx` — Adopted `PageHeader`, `WeaveDivider`, fewer nested borders, and modular split structure
- `src/i18n/locales/{en,mr,hi}.json`, `docs/I18N_REVIEW.md` — Expanded to `488 / 488` keys at 100% parity across English, Marathi, and Hindi

### Deleted Files
- None (`0` files deleted; all existing uncommitted/untracked workspace files preserved).

---

## 3. Component & Page Splits Completed

| Page File | Before (lines) | After (lines) | Extracted Modules |
|---|---|---|---|
| `DashboardPage.tsx` | `573` | `218` | `dashboardHelpers.ts`, `DashboardOperationalCards.tsx`, `DashboardCharts.tsx` |
| `CatalogPage.tsx` | `521` | `220` | `CatalogToolbar.tsx`, `CatalogCardsGrid.tsx`, `CatalogImportDialog.tsx` |
| `QuickSalePage.tsx` | `418` | `179` | `useQuickSaleController.ts`, `QuickSaleCatalogPanel.tsx` |
| `StockPage.tsx` | `381` | `165` | `StockToolbar.tsx`, `StockListView.tsx` |
| `CheckoutPage.tsx` | `352` | `155` | `CheckoutSteps.tsx` |
| `ShopPage.tsx` | `308` | `194` | `ShopHero.tsx`, `ShopToolbar.tsx`, `ShopTrustFooter.tsx` |
| `StaffOrdersPage.tsx` | `297` | `185` | `StaffOrderCard.tsx` |
| `DeliveryOrdersPage.tsx` | `272` | `133` | `DeliveryOrderCard.tsx` |
| `LandingPage.tsx` | `100` | `7` | Delegates cleanly to `ShopPage.tsx` inside `CustomerLayout` |

*(Remaining longer pages — `VegetableFormPage.tsx` `309`, `PricingPage.tsx` `301`, `StyleGuidePage.tsx` `297`, `NewPurchasePage.tsx` `284`, `PaymentsPage.tsx` `258` — were kept intact for low-risk stability and remain candidates for future form extraction.)*

---

## 4. Features Skipped / Blocked by Missing Backend API Contracts

No backend endpoints or fake client state were invented (`docs/BACKEND_REQUESTS.md` tracks the underlying API gaps):
- Delivery pincode pre-check outside checkout submission (no `GET /api/public/config` serviceable-pincode endpoint; exact server error displayed verbatim on checkout submit)
- Multi-day sales trends, customer ratings, discounts, popular/seasonal tags, per-vegetable minimum stock config, and purchase cost column on `/api/staff/catalog`
- `baseUnit` display on `OrderResponse.Item` and `DailyReport` top items / wastage lines
- Individual pending refund list (`GET /api/payments/refunds/pending`) — Owner "Needs attention" detects `CANCELLED` + `ONLINE` orders from `/api/orders` and routes cleanly to `/staff/payments`

---

## 5. Open Questions

1. **Native Language Review:** Walk through the newly drafted Marathi and Hindi store/hero/trust strings listed in [`docs/I18N_REVIEW.md`](./I18N_REVIEW.md) with a store operator.
2. **Real Vegetable Photos:** Supply verified `600x600` MozJPEG (`<= 80 KB`) photos under `public/vegetables/<slug>.jpg` per [`docs/PHOTO_GUIDE.md`](./PHOTO_GUIDE.md) and log licences in [`docs/IMAGES.md`](./IMAGES.md).
3. **Full-Stack E2E Smoke Run:** Boot `tazatokri-backend` locally and run `npx playwright test` plus real-device mobile checkout/counter tests.

---

Backend untouched (git diff --stat shows no tazatokri-backend changes). No images downloaded or generated. No fake data added.
