# TazaTokri Visual & Structural Redesign Plan (`REDESIGN_PLAN.md`)

**Scope:** Frontend-only visual redesign and structural refactor (`c:\Taza_Tokri`).  
**Backend (`tazatokri-backend/`):** Strictly read-only — zero edits to Java files, `application.properties`, Flyway SQL, `pom.xml`, or enums.

---

## 1. Audit of Current Generic Patterns & Gaps

Based on reading `src/app/router.tsx`, `src/styles/globals.css`, layouts, shared components, and feature pages:

1. **Disconnected Landing & Shop:** `/` (`LandingPage.tsx`) is a separate static promo screen from `/shop` (`ShopPage.tsx`), forcing customers through an extra click instead of landing directly on the calm editorial market experience.
2. **Mobile Bottom Bar Gap (`CustomerLayout.tsx`):** Mobile navigation omits the **Cart** shortcut (`Shop, Orders, Account` when authenticated, `Shop, Login` otherwise) rather than providing the four daily customer tabs (`Shop`, `Orders`, `Cart`, `Account`).
3. **Missing Signature Motif & Shared Primitives:**
   - No `PageHeader` primitive (`h1` toolbars are duplicated inconsistently across 12+ pages).
   - No `WeaveDivider` (`tokri` woven-basket horizontal divider) linking section headings, empty states, customer footer, and chalkboard headers.
   - Radius (`--radius: 0.75rem`) and nested cards inside cards create boxy edges; base mobile text sits at `14px` in places instead of `>= 16px` readability.
4. **Customer Card & Filter Gaps (`ShopPage.tsx`, `VegetableCard.tsx`):**
   - `ShopPage.tsx` has bilingual search and category filtering, but lacks client-side **Sort** (`Name A–Z`, `Price: Low to High`, `Price: High to Low`), trust strip (`Picked fresh`, `Pay for actual weight`, `Cash or UPI`), and a clean footer.
   - `VegetableCard.tsx` mixes rounded image borders inside cards and has `MoneyDisplay` unit price subordinate to size text instead of making price per base unit the unmistakable visual anchor.
5. **Staff Catalog & Grouped Nav (`CatalogPage.tsx`, `StaffLayout.tsx`):**
   - `CatalogPage.tsx` lacks **status filter pills** (`All`, `Available today`, `Out of stock`, `No price`) and exposes a plain table toggle rather than clean desktop grid / compact mobile cards with `StockMeter`.
   - `StaffLayout.tsx` lists all links flat in the sidebar instead of grouping clearly under **Today, Sell, Products, Buy, Orders, Money, Team**.
6. **Oversized Pages (> 250 lines):**
   - `DashboardPage.tsx` (`573` lines), `CatalogPage.tsx` (`521` lines), `QuickSalePage.tsx` (`418` lines), `StockPage.tsx` (`381` lines), `CheckoutPage.tsx` (`352` lines), `VegetableFormPage.tsx` (`309` lines), `ShopPage.tsx` (`308` lines), `PricingPage.tsx` (`307` lines), `StaffOrdersPage.tsx` (`297` lines), `NewPurchasePage.tsx` (`284` lines), `DeliveryOrdersPage.tsx` (`272` lines), and `PaymentsPage.tsx` (`270` lines) mix pure helper logic and sub-sections inside page files.

---

## 2. Target Visual Language & Component Structure

### A. Palette, Typography, Spacing & Motif
- **CSS Variables (`src/styles/globals.css`):** Keep exact brand values (`#2F6B45` leaf green, `#1F4A30` deep forest, `#E9F1E6` sage, `#FBF8F1` cream, `#E3A21A` turmeric, `#C8442F` tomato, `#5B3A6B` brinjal, `#7A5A3A` soil, `#1E2420` charcoal, `#6B746D` muted). Upgrade base `--radius` to `1rem` (`16px`–`24px` cards, full pill chips), mobile body base `16px`, smooth `150–250ms` transitions (respecting `prefers-reduced-motion`), and `:lang(mr), :lang(hi) { line-height: 1.65; letter-spacing: 0; }`.
- **Shared Primitives (`src/components/`):**
  - `PageHeader.tsx` *(new)* — Unified page `h1`, optional subtitle/count badge, optional `WeaveDivider` accent, and responsive action slot.
  - `WeaveDivider.tsx` *(new)* — Subtle geometric woven-tokri hairline/pattern SVG divider (`aria-hidden`) used sparingly on section transitions, `EmptyState`, footer, and `/display/prices`.
  - `ProductCard.tsx` *(unified wrapper/alias around `VegetableCard.tsx`)* — Edge-to-edge `1:1` category wash artwork, dominant price per base unit, large native name + small English name, label-only ascending size chips (default marked), stepper, and strict `"In stock"` / `"Out of stock"` badge (never `"Low stock"`).
  - Existing reused primitives: `SectionHeader`, `PriceTag`, `StatusBadge` (always icon + text), `StockMeter`, `EmptyState`, `ErrorState`, `Skeletons`, `Logo`, `LanguageSwitcher`, `VegetableImage`, `VegetablePlaceholder`.

### B. Feature Refactor & Splits
1. **Customer (`/` & `/shop`):**
   - Share one editorial `EditorialShopView` (`ShopPage.tsx`) rendered seamlessly on both `/shop` (`CustomerLayout`) and `/` (`LandingPage` reuses it cleanly inside the public/shop flow without breaking existing routes or auth guards!).
   - `ShopHeroStrip.tsx`, `ShopTrustFooter.tsx`, `ShopToolbar.tsx` (`search` EN/MR/HI + `sort` Name/Price + category rail) keep `ShopPage.tsx` < 220 lines.
   - `CustomerLayout.tsx`: 4-item mobile bottom bar (**Shop, Orders, Cart, Account**) + accessible header (`Logo`, desktop links, `RoleSwitcher`, `LanguageSwitcher`, live `Cart` counter).
   - `CheckoutPage.tsx`: Split into `CheckoutStepper.tsx`, `CheckoutAddressStep.tsx`, `CheckoutPaymentStep.tsx`, `CheckoutSummaryCard.tsx`.
2. **Staff (`QuickSalePage`, `CatalogPage`, `StockPage`, `StaffOrdersPage`, `StaffLayout`):**
   - `StaffLayout.tsx`: Group navigation under **Today, Sell, Products, Buy, Orders, Money, Team**.
   - `QuickSalePage.tsx`: Extract `QuickSaleToolbar.tsx` + `useQuickSaleState.ts` / helpers (`< 230` lines); preserve `clientRef`, keypad, sticky desktop bill, mobile bottom sheet, one-tap tile body -> default unit add, dimmed out-of-stock & disabled Set-price state.
   - `CatalogPage.tsx`: Extract `CatalogToolbar.tsx` (with **All / Available today / Out of stock / No price** filters + search + categories) and `CatalogCardsGrid.tsx` (responsive grid on desktop, compact horizontal cards on mobile — no spreadsheet table look) + `CatalogImportDialog.tsx`.
   - `StockPage.tsx`: Extract `StockToolbar.tsx` + `StockListView.tsx`.
   - `StaffOrdersPage.tsx`: Extract `StaffOrderCard.tsx` and keep status tabs with live counts.
3. **Owner & Delivery (`DashboardPage`, `PricingPage`, `DeliveryOrdersPage`, `PaymentsPage`, `NewPurchasePage`):**
   - `DashboardPage.tsx`: Extract pure `dashboardHelpers.ts` (`buildAttentionItems` covering out/low stock, unpriced vegetables, orders waiting, cash held, and pending refunds action + links), `DashboardCharts.tsx`, and `DashboardOpsGrid.tsx`.
   - `PricingPage.tsx`, `ChalkboardPriceBoardPage.tsx`, `PaymentsPage.tsx`, `NewPurchasePage.tsx`, `DeliveryOrdersPage.tsx`: Adopt `PageHeader`, `WeaveDivider`, grouped card/divider layout without nested card boxes, and extract card/form subcomponents where pages exceed ~250 lines.

---

## 3. Verification Strategy

1. Add Vitest coverage in `src/tests/` for client-side sort & search, `buildAttentionItems`, and cart pruning helpers; keep all existing tests passing.
2. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check:images`.
3. Capture headless Chrome screenshots across `360`, `390`, `768`, and `1440` px into `docs/screens/redesign-2/` verifying `0` horizontal overflows, `0` broken images, and `0` runtime errors.
4. Write `docs/TAZATOKRI_UI_REDESIGN_REPORT.md` and report final `git status --short` + `git diff --stat` confirming `tazatokri-backend/` is untouched.
