# TazaTokri Phase 0 Read-Only Audit

**Audit Date:** 2026-11-15  
**Scope:** Frontend (`c:\Taza_Tokri`) and read-only inspection of Backend (`c:\Taza_Tokri\tazatokri-backend`).  
**Mode:** Read-only audit. Zero application code, backend source, Flyway migrations, properties, or database rows were modified.

---

## 1. Folder Structure, Architecture, Dependencies & Scripts

### Folder Structure
Feature-sliced React + TypeScript + Vite SPA/PWA architecture:
- Root configs: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `.env`, `.env.example`
- `src/app/`: `App.tsx`, `providers.tsx`, `router.tsx`
- `src/lib/`: `api.ts`, `businessRules.ts`, `dates.ts`, `money.ts`, `utils.ts`
- `src/hooks/`: `useVegetableName.ts`
- `src/components/`: `EmptyState.tsx`, `ErrorBoundary.tsx`, `LanguageSwitcher.tsx`, `MoneyDisplay.tsx`, `PageLoader.tsx`, `RoleSwitcher.tsx`, `RouteGuard.tsx`, `StatusPage.tsx`, `VegetableImage.tsx`
- `src/components/layout/`: `PublicLayout.tsx`, `CustomerLayout.tsx`, `StaffLayout.tsx`, `DeliveryLayout.tsx`
- `src/components/ui/`: shadcn-style Radix/Tailwind primitives (`badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `progress.tsx`, `select.tsx`, `sheet.tsx`, `skeleton.tsx`, `switch.tsx`, `tabs.tsx`)
- `src/features/`: feature modules (`auth`, `cart`, `catalog`, `delivery`, `inventory`, `landing`, `orders`, `payments`, `pricing`, `purchase`, `report`, `sales`, `users`), typically split into `api.ts`, `types.ts`, `hooks.ts`, `pages/`, `components/`, and optional `store.ts` / `schemas.ts`
- `src/i18n/`: `index.ts` and `locales/{en,mr,hi}.json`
- `src/mocks/`: `browser.ts`, `server.ts`, `handlers/index.ts`, `handlers/staffCatalog.ts`
- `src/pages/`: `ComingSoonPage.tsx`, `ForbiddenPage.tsx`, `NotFoundPage.tsx`, `StyleGuidePage.tsx`
- `src/styles/`: `globals.css`
- `src/tests/`: Vitest + Testing Library unit/integration suites (`setup.ts` + 7 test files)
- `public/`: `icons/` (5 PNGs), `mockServiceWorker.js`, `vegetables/.gitkeep` (0 `.jpg` files present)
- `tests/e2e/`: `critical-flows.spec.ts` (Playwright)
- `scripts/`: `check-images.mjs`
- `docs/`: `IMAGES.md`, `AUDIT.md`, `BACKEND_REQUESTS.md`

### `package.json` Dependencies
- **Runtime:** `react` `^19.0.0`, `react-dom` `^19.0.0`, `react-router-dom` `^7.0.2`, `@tanstack/react-query` `^5.62.3`, `zustand` `^5.0.2`, `react-hook-form` `^7.54.2`, `@hookform/resolvers` `^3.9.1`, `zod` `^3.23.8`, `i18next` `^24.0.5`, `react-i18next` `^15.1.3`, `i18next-browser-languagedetector` `^8.0.2`, `decimal.js` `^10.4.3`, `date-fns` `^4.1.0`, `date-fns-tz` `^3.2.0`, `recharts` `^2.13.3`, `sonner` `^1.7.1`, `lucide-react` `^0.468.0`, `clsx` `^2.1.1`, `tailwind-merge` `^2.6.0`, `class-variance-authority` `^0.7.1`, `@radix-ui/react-dialog` `^1.1.4`, `@radix-ui/react-label` `^2.1.1`, `@radix-ui/react-progress` `^1.1.1`, `@radix-ui/react-select` `^2.1.4`, `@radix-ui/react-slot` `^1.1.1`, `@radix-ui/react-switch` `^1.1.2`, `@radix-ui/react-tabs` `^1.1.2`.
- **Dev:** `typescript` `^5.7.2`, `vite` `^6.0.3`, `@vitejs/plugin-react` `^4.3.4`, `@tailwindcss/vite` `^4.0.0`, `tailwindcss` `^4.0.0`, `vite-plugin-pwa` `^0.21.1`, `vitest` `^2.1.8`, `@testing-library/react` `^16.1.0`, `@testing-library/user-event` `^14.5.2`, `@testing-library/jest-dom` `^6.6.3`, `jsdom` `^25.0.1`, `msw` `^2.6.8`, `@playwright/test` `^1.49.0`, `eslint` `^9.17.0`, `typescript-eslint` `^8.18.2`, `prettier` `^3.4.2`, `prettier-plugin-tailwindcss` `^0.6.9`.

### `package.json` Scripts
`dev`, `build` (`tsc -b && vite build`), `preview`, `lint` (`eslint . --max-warnings 0`), `format`, `test` (`vitest run`), `test:watch`, `test:e2e` (`playwright test`), `typecheck` (`tsc --noEmit`), `check:images` (`node scripts/check-images.mjs`).

---

## 2. Routes, Layouts, Pages, Components, Hooks, Stores & Query Keys

### Layouts & Routes (`src/app/router.tsx`)
| Layout / Guard | Path | Page Component | Notes |
|---|---|---|---|
| `PublicLayout` | `/` | `LandingPage` | Public marketing/entry screen |
| `PublicLayout` | `/login` | `LoginPage` | Phone + password login |
| `PublicLayout` | `/signup` | `SignupPage` | Customer self-signup |
| `CustomerLayout` | `/shop` | `ShopPage` | Public browse; cart drawer triggers checkout |
| `CustomerLayout` + `RouteGuard(['CUSTOMER'])` | `/shop/checkout` | `CheckoutPage` | Requires `CUSTOMER` role |
| `CustomerLayout` + `RouteGuard(['CUSTOMER'])` | `/shop/orders` | `CustomerOrdersPage` | Paginated (`page`) customer orders |
| `CustomerLayout` + `RouteGuard(['CUSTOMER'])` | `/shop/orders/:id` | `CustomerOrderDetailPage` | Order detail + Razorpay verify/poll + cancel |
| `CustomerLayout` + `RouteGuard(['CUSTOMER'])` | `/shop/account` | `AccountPage` | Profile summary + saved addresses |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff` | `<Navigate to="/staff/sale" replace />` | Default staff landing |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/sale` | `QuickSalePage` | POS quick billing + recent sales tab |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/orders` | `StaffOrdersPage` | Confirm, pack, assign, cancel orders |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/stock` | `StockPage` | Stock list, wastage, owner adjustment, movements |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/catalog` | `CatalogPage` | Veg list, availability/active toggles, 36-veg seed |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/catalog/new` | `VegetableFormPage` | Create vegetable + selling options |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/catalog/:id` | `VegetableFormPage` | Edit vegetable names/category/imageUrl |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/categories` | `CategoriesPage` | List + create categories |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/suppliers` | `SuppliersPage` | List + create suppliers |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/purchases` | `PurchasesPage` | Owner sees table (`enabled = isOwner`) |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/purchases/new` | `NewPurchasePage` | Record mandi purchase (STAFF + OWNER) |
| `StaffLayout` + `RouteGuard(['OWNER','STAFF'])` | `/staff/purchases/:id` | `PurchaseDetailPage` | Owner purchase breakdown |
| `StaffLayout` + `RouteGuard(['OWNER'])` | `/staff/dashboard` | `DashboardPage` | Daily report KPIs + Recharts + sample banner |
| `StaffLayout` + `RouteGuard(['OWNER'])` | `/staff/pricing` | `PricingPage` | Current prices, set price, history, AI/cost suggestion |
| `StaffLayout` + `RouteGuard(['OWNER'])` | `/staff/payments` | `PaymentsPage` | Pending cash settle + process Razorpay refunds |
| `StaffLayout` + `RouteGuard(['OWNER'])` | `/staff/users` | `UsersPage` | Register users + lists delivery people only |
| `DeliveryLayout` + `RouteGuard(['DELIVERY'])` | `/delivery` | `DeliveryOrdersPage` | Assigned orders, call/maps, start/deliver/fail |
| Standalone | `/403`, `/404`, `*` | `ForbiddenPage`, `NotFoundPage` | Error/status pages |
| Dev-only (`import.meta.env.DEV`) | `/dev/styleguide` | `StyleGuidePage` | Visual token showcase |

### Layout Observations
- `StaffLayout.tsx`: Desktop shows full sidebar (`navItems`); mobile shows bottom bar sliced with `.slice(0, 5)`, omitting `Pricing`, `Payments`, `Users`, and `Suppliers` from mobile bottom navigation for `OWNER`.
- `DeliveryLayout.tsx`: Contains `<RoleSwitcher />` and logout, **but omits `<LanguageSwitcher />`** (unlike `PublicLayout`, `CustomerLayout`, and `StaffLayout`).
- No custom React Contexts exist (`src/app/providers.tsx` only wraps `<QueryClientProvider>`, `<Toaster />`, and `<ErrorBoundary>`).

### Zustand Stores
- `useAuthStore` (`src/features/auth/store.ts`): state `{ user: AuthUser | null, activeRole: Role | null }`, persisted to `localStorage['tazatokri-auth']` plus `localStorage['token']`.
- `useCartStore` (`src/features/cart/store.ts`): state `{ items: CartItem[], clientRef: string }` (`clientRef` generated via `crypto.randomUUID()`), persisted to `localStorage['tazatokri-cart']`.

### React Query Keys (Per-Feature `hooks.ts`)
- `authKeys`: `['auth', 'me']`
- `catalogKeys`: `['catalog', 'public']`, `['catalog', 'staff']`, `['catalog', 'categories']`, `['catalog', 'vegetables']`, `['catalog', 'vegetables', id]`
- `deliveryKeys`: `['delivery', 'people']`, `['delivery', 'attempts', orderId]`, `['delivery', 'my-orders']`
- `inventoryKeys`: `['inventory', 'stock', vegId]`, `['inventory', 'movements', vegId, page]`
- `ordersKeys`: `['orders', 'customer', page]`, `['orders', 'customer', id]`, `['orders', 'staff', params]`, `['orders', 'staff', id]`
- `paymentsKeys`: `['payments', 'order', orderId]`, `['payments', 'cash-pending']`
- `pricingKeys`: `['pricing', 'current']`, `['pricing', 'history', vegId, page]`, `['pricing', 'suggestion', vegId]`
- `purchaseKeys`: `['purchase', 'suppliers']`, `['purchase', 'list', page]`, `['purchase', 'detail', id]`
- `reportKeys`: `['report', 'daily', date ?? 'today']`
- `salesKeys`: `['sales', 'list', date]`, `['sales', 'detail', id]`
- `usersKeys`: `['users', 'addresses']`

---

## 3. API Client, Services & TypeScript Types

- **`src/lib/api.ts`**:
  - `BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'`
  - Attaches `Authorization: Bearer <token>` from `localStorage.getItem('token')` unless `options.public === true`.
  - Parses JSON responses (handles `204` or empty body cleanly).
  - Throws `ApiHttpError(status, message, fieldErrors)` extracted from `{ message, error, detail, fieldErrors, errors }`.
  - On HTTP `401` (when `!options.public`), dispatches `window.dispatchEvent(new CustomEvent('auth:unauthorized'))`. Network errors produce `status: 0`.
- **Feature `api.ts` modules**: `auth`, `catalog`, `delivery`, `inventory`, `orders`, `payments`, `pricing`, `purchase`, `report`, `sales`, `users` — thin wrappers over `api.get/post/put/patch/del`.
- **Backend compatibility DTO gaps in TS types**:
  - `src/features/delivery/types.ts:3-9` includes `'IN_PROGRESS'` in `DeliveryStatus` (backend enum only has `ASSIGNED | OUT_FOR_DELIVERY | DELIVERED | FAILED | UNASSIGNED`).
  - `src/features/payments/types.ts:4-5` includes `'UPI'` in `PaymentMethod` and `'SETTLED'` in `PaymentStatus` (backend `PaymentMethod` is `CASH | UPI_QR | RAZORPAY`, `PaymentStatus` is `PENDING | SUCCESS | FAILED`; settlement sets `settledAt`).

---

## 4. Auth: Token Storage, 401 Handling, Guards & Multi-Role Behaviour

- **Token Storage (`src/features/auth/store.ts` & `src/lib/api.ts`):**
  - Raw JWT is written directly to `localStorage['token']` AND simultaneously stored inside `localStorage['tazatokri-auth']` (`state.user.token`) via Zustand `persist`.
  - No `HttpOnly` cookie is used; JWT is readable by any JS running in the origin (XSS risk).
- **401 Handling (`src/main.tsx:10-23`, `src/app/providers.tsx:16-18`):**
  - Global `auth:unauthorized` event triggers `useAuthStore.getState().logout()`, `queryClient.clear()`, and if the user was previously logged in, redirects via `window.location.replace('/login?expired=1&next=...')`.
  - QueryClient disables automatic retries on `401`, `403`, and `404`.
- **Role Guards (`src/components/RouteGuard.tsx` & `src/features/auth/roles.ts`):**
  - `RouteGuard` checks `useAuthStore((s) => s.user)`: redirects unauthenticated users to `/login?next=<encoded>` and users lacking any of `allowedRoles` to `/403`.
  - `/api/me` (`AuthHydrator` in `router.tsx` / `useMe`) re-validates session on load; `normalizeRoles()` handles both `Role[]` and Spring Security bracketed strings like `"[ROLE_OWNER, ROLE_DELIVERY]"`.
- **Multi-Role Behaviour (`RoleSwitcher.tsx` & `roles.ts`):**
  - Priority order: `OWNER > STAFF > DELIVERY > CUSTOMER`.
  - Users with multiple distinct workspace roles see `<RoleSwitcher />` dropdown in `CustomerLayout`, `StaffLayout`, and `DeliveryLayout` to switch `activeRole` and navigate (`OWNER`/`STAFF` -> `/staff`, `DELIVERY` -> `/delivery`, `CUSTOMER` -> `/shop`).

---

## 5. i18n (`en`, `mr`, `hi`) Key Coverage & Hard-Coded Strings

### Locale Key Coverage (`src/i18n/locales/{en,mr,hi}.json`)
- **`en.json`:** 340 flattened keys
- **`mr.json`:** 221 flattened keys (**119 keys missing**, e.g. `checkout.*`, `addresses.*`, `staff.sale.*`, `staff.stock.*`, `staff.orders.*`, `staff.dashboard.*`, `staff.pricing.*`, `delivery.*`, `errors.network`, etc.)
- **`hi.json`:** 217 flattened keys (**123 keys missing**, same modules plus `common.optional`, `common.required`, `shop.cartEmptyHint`, `orders.cancelReason`)
- Missing keys silently fall back to English (`fallbackLng: 'en'` in `src/i18n/index.ts`).

### Hard-Coded User-Facing English Strings in UI Code
- `src/features/catalog/pages/CatalogPage.tsx`: `"Catalog import summary:"` (L144), `"Import 36 Default Vegetables"` (L320), description paragraph (L321-325), `"Include sample prices ..."` (L335-339), `"Confirm Import"` (L356)
- `src/features/catalog/pages/VegetableFormPage.tsx`: `"PIECE"`, `"BUNCH"` (L225-226), Zod `'Required'` messages (L26, L36, L40), placeholder `"https://..."` (L239)
- `src/features/catalog/hooks.ts`: `toast.error('Could not update availability')` (L107)
- `src/features/report/pages/DashboardPage.tsx`: `"Sample data active"` (L85), sample-data warning copy (L87-91), `"Review prices →"` (L98), `aria-label="Report date"` (L71)
- `src/features/delivery/pages/DeliveryOrdersPage.tsx`: `"Paid"` badge (L76)
- `src/features/orders/pages/CheckoutPage.tsx`: `"Default"` badge (L163)
- `src/features/users/pages/AccountPage.tsx`: `"Default"` badge (L77)
- `src/features/orders/components/StaffOrderModals.tsx`: `"Previous attempts"` (L94)
- `src/components/ErrorBoundary.tsx`: `"Something went wrong"` (L37)
- `src/features/catalog/pages/CategoriesPage.tsx`, `SuppliersPage.tsx`, `NewPurchasePage.tsx`, `AddAddressDialog.tsx`: Zod `'Required'` literals and placeholder `"Leafy Greens"`
- Multiple `aria-label` strings (`"Close"`, `"Decrease"`, `"Increase"`, `"Decrease quantity"`, `"Increase quantity"`, `"Sale date"`)

---

## 6. CSS, Tailwind Config, shadcn Components, Design Tokens & Fonts

- **Tailwind CSS v4 (`@tailwindcss/vite` + `@import "tailwindcss";` in `src/styles/globals.css`)** — no `tailwind.config.*` file; tokens are declared in CSS variables + `@theme inline`.
- **Fonts (`index.html`):** Google Fonts `Nunito` (400..800, `--font-display`), `Inter` (400..600, `--font-sans`), `Noto Sans Devanagari` (400..700); Devanagari locales receive `line-height: 1.6`.
- **Design Tokens (`src/styles/globals.css`):**
  - Warm off-white background (`#faf9f6`), white cards, deep garden green primary (`#2d7a4f`), sage secondary (`#e8f5ee`), tomato danger (`#c0392b`), turmeric warning (`#e6a817`).
  - Dark mode tokens defined via `@custom-variant dark (&:where(.dark, .dark *));`, though no theme switcher UI exists.
  - Utilities: `.skeleton` shimmer, `.touch-target` (`min-height: 48px; min-width: 48px`).
- **UI Primitives (`src/components/ui/`):** 12 Tailwind/Radix primitives (`badge`, `button`, `card`, `dialog`, `input`, `label`, `progress`, `select`, `sheet`, `skeleton`, `switch`, `tabs`). Zero unrequested UI libraries.

---

## 7. Existing Tests & Coverage

- **Vitest + MSW + Testing Library (`src/tests/`, 7 files, 28 tests — all passing):**
  1. `authRoles.test.ts` (3): Role string/array parsing (`"[ROLE_OWNER, ROLE_DELIVERY]"`), priority home path (`OWNER > STAFF > DELIVERY > CUSTOMER`), safe `next` URL routing.
  2. `cartStore.test.ts` (3): Idempotent `clientRef` persistence across cart updates, `localStorage` rehydration, reuse after failed order submit, rotation on clear.
  3. `defaultCatalog.test.ts` (4): Exact 36 vegetable slugs, `resolveVegetableImage()` Wikimedia rejection + `/vegetables/<slug>.jpg` default, 36-vegetable integrity check, `seedDefaultCatalog(withSamplePrices)` HTTP query param verification.
  4. `loginForm.test.tsx` (2): Zod validation (invalid phone/short password without network call) & server 401 error rendering.
  5. `money.test.ts` (8): `Decimal.js` paise arithmetic, INR formatting, `formatQty` trimming, `businessRules` display constants & 18:00 IST cutoff boundary (`17:59` today vs `18:00` tomorrow).
  6. `quickSaleAndCatalog.test.tsx` (4): `<VegetableImage />` fallback on error, `QuickSaleTile` rendering & disabled out-of-stock chips, `QuickSaleBill` zero/empty/over-stock guards.
  7. `routeGuard.test.tsx` (4): Unauthenticated redirect to `/login?next=...`, unauthorized redirect to `/403`, multi-role switching (`OWNER + DELIVERY`), `/api/me` normalization.
- **Playwright E2E (`tests/e2e/critical-flows.spec.ts`, NOT TESTED in Phase 0):** 3 mocked E2E specs (`page.route()` mocks API responses rather than hitting live Spring Boot).

---

## 8. Reusable Components & Logic That Must Be Preserved

1. **`src/lib/money.ts`**: `Decimal.js` exact money/quantity math (`toPaise`, `fromPaise`, `addMoney`, `subMoney`, `mulMoney`, `sumMoney`, `formatMoney`, `formatQty`, `toApiQty`, `toApiMoney`, `isBelow`, `isPositive`, `isValidDecimal`).
2. **`src/lib/dates.ts`**: Asia/Kolkata (`IST`) date/time formatting & `18:00` cutoff helpers (`todayIST`, `fmtDate`, `fmtTime`, `fmtDateTime`, `currentHourIST`, `fmtCountdown`).
3. **`src/lib/api.ts`**: Centralized `Authorization` header injection, structured `ApiHttpError` + `fieldErrors` parsing, and `auth:unauthorized` event dispatch.
4. **`src/features/cart/store.ts`**: Idempotent `clientRef` generation and rotation rules on checkout success.
5. **`src/features/auth/roles.ts` & `RouteGuard.tsx` & `RoleSwitcher.tsx`**: Defensive Spring role normalization, priority routing, and multi-role switching.
6. **`src/components/VegetableImage.tsx` & `src/features/catalog/vegetableImages.ts` & `src/hooks/useVegetableName.ts`**: Self-hosted `/vegetables/<slug>.jpg` resolver, clean error fallback placeholder, and trilingual display-name selector.
7. **`src/components/MoneyDisplay.tsx`, `EmptyState.tsx`, `ErrorBoundary.tsx`, `StatusPage.tsx`, `LanguageSwitcher.tsx`**: Accessible shared UX building blocks.

---

## 9. Endpoint Map (Frontend vs Real Backend)

Every active frontend API module was compared against `tazatokri-backend` controllers/DTOs.

### Mismatches & Unused Backend Routes Flagged
1. **`GET /api/me` (`PingController.java`)**: Backend returns `{ phone: string, roles: string }` (e.g. `"[ROLE_OWNER]"`), omitting `userId`, `fullName`, and JSON array roles; frontend uses `normalizeRoles()` workaround (`roles.ts:27`).
2. **`DeliveryStatus` (`delivery/types.ts:3-9` vs `DeliveryStatus.java`)**: Frontend includes `'IN_PROGRESS'` which does not exist in backend enum `{ ASSIGNED, OUT_FOR_DELIVERY, DELIVERED, FAILED, UNASSIGNED }`.
3. **`PaymentRecord` (`payments/types.ts:4-5` vs `PaymentMethod.java`, `PaymentStatus.java`)**: Frontend includes `'UPI'` in `PaymentMethod` (backend has `CASH | UPI_QR | RAZORPAY`) and `'SETTLED'` in `PaymentStatus` (backend has `PENDING | SUCCESS | FAILED`; settlement populates `settledAt`).
4. **Backend routes declared in frontend `api.ts` / `hooks.ts` or backend-only with no active page consumer**:
   - `GET /api/ping` — backend only, unused by frontend.
   - `GET /api/inventory/stock/{vegetableId}` (`inventory/api.ts:10`, `useStock`) — unused by `StockPage.tsx` (which reads stock from `GET /api/staff/catalog`).
   - `GET /api/payments/orders/{orderId}` (`payments/api.ts:10`, `useOrderPayments`) — unused in any page/dialog.
   - `GET /api/orders/{id}` (`useStaffOrder`), `GET /api/sales/{id}` (`useSale`) — unused in pages.
   - `POST /api/payments/razorpay/webhook` — server-to-server Razorpay webhook.
5. **Minor validation difference**: `PricingDialogs.tsx:32` limits `note` to `max(200)` while backend `SetPriceRequest` allows `@Size(max = 255)`.

### Full Endpoint Comparison Table
| Feature | Frontend Call | Backend Controller & Path | Request / Response Notes |
|---|---|---|---|
| Auth Login | `POST /api/auth/login` (`public: true`) | `AuthController.login` | Matches (`LoginRequest` -> `LoginResponse`) |
| Auth Signup | `POST /api/auth/signup` (`public: true`) | `AuthController.signup` | Matches (`CustomerSignupRequest` -> `UserResponse`) |
| Auth Register | `POST /api/auth/register` | `AuthController.register` (`OWNER`) | Matches (`RegisterRequest` -> `UserResponse`) |
| Current User | `GET /api/me` | `PingController.me` | Returns `{ phone, roles: String }`, no `userId`/`fullName` |
| Public Shop Catalog | `GET /api/public/vegetables` (`public: true`) | `PublicCatalogController.list` | Matches (`PublicVegetableResponse[]`) |
| Staff Catalog | `GET /api/staff/catalog` | `StaffCatalogController.list` | Matches (`StaffCatalogItemResponse[]`) |
| Categories | `GET`, `POST /api/categories` | `CategoryController` (`POST` `OWNER`) | Matches (`CategoryResponse[]` / `CategoryRequest`) |
| Vegetables CRUD | `GET`, `POST /api/vegetables`, `GET/PUT /api/vegetables/{id}`, `PATCH /availability`, `PATCH /active` | `VegetableController` | Matches (`PUT` only updates metadata, not `baseUnit`/`units`) |
| Seed 36 Vegetables | `POST /api/vegetables/seed-catalog?withSamplePrices=` | `VegetableController.seedCatalog` | Matches (`SeedSummary`) |
| Inventory | `GET /api/inventory/stock/{id}/movements?page=`, `POST /wastage`, `POST /adjustments` | `InventoryController` (`adjustments` `OWNER`) | Matches; `GET /stock/{id}` unused in UI |
| Pricing | `GET /api/pricing/current`, `PUT /vegetables/{id}`, `GET /history?page=`, `GET /suggestion`, `POST /apply-suggestion` | `PricingController` (suggestion `OWNER`) | Matches (`SetPriceRequest` client max 200 vs server 255) |
| Suppliers & Purchases | `GET/POST /api/suppliers`, `GET/POST /api/purchases`, `GET /api/purchases/{id}` | `SupplierController`, `PurchaseController` (`GET` `OWNER`) | Matches (`PurchasesPage` guards `enabled = isOwner`) |
| POS Quick Sales | `POST /api/sales`, `GET /api/sales?date=` | `SaleController` | Matches (`GET /api/sales/{id}` unused in UI) |
| Daily Report | `GET /api/reports/daily?date=` | `ReportController.daily` (`OWNER`) | Matches (`DailyReport`; items lack `baseUnit`) |
| Customer Addresses | `GET`, `POST /api/customer/addresses` | `CustomerAddressController` (`CUSTOMER`) | Matches (`AddressRequest` / `AddressResponse[]`) |
| Customer Orders | `POST`, `GET /api/customer/orders?page=`, `GET /{id}`, `POST /{id}/cancel` | `CustomerOrderController` (`CUSTOMER`) | Matches (`list` returns empty `items: []`) |
| Customer Payment | `POST /api/customer/orders/{id}/payment`, `POST .../verify` | `CustomerPaymentController` (`CUSTOMER`) | Matches (`PaymentInit` / `VerifyResult`) |
| Staff Orders | `GET /api/orders?date=&status=`, `POST /{id}/confirm`, `/{id}/pack`, `/{id}/cancel` | `StaffOrderController` | Matches (`GET /api/orders/{id}` unused in UI) |
| Delivery Dispatch | `GET /api/delivery/people`, `POST /api/orders/{id}/assign`, `GET /api/orders/{id}/deliveries` | `DeliveryAdminController` | Matches |
| Delivery Rider | `GET /api/delivery/orders`, `POST /{id}/start`, `/{id}/deliver`, `/{id}/fail` | `DeliveryController` (`DELIVERY`) | Frontend `DeliveryStatus` includes non-existent `'IN_PROGRESS'` |
| Cash & Refunds | `GET /api/payments/cash-pending`, `POST /api/payments/settle`, `POST /api/payments/refunds/process` | `PaymentController`, `RefundController` (`OWNER`) | `PaymentStatus`/`PaymentMethod` TS types have extra values; `GET /orders/{id}` unused |

**Unknown / Non-Existent Endpoint Check:** Zero calls in `src/` to `/api/ping/me`, `/api/stock`, `/api/reports/summary`, `/api/shop/catalog`, or `/api/users`.

---

## 10. Risk List (Frontend)

1. **Duplicate Raw JWT in `localStorage` (`src/features/auth/store.ts:30,57`, `src/lib/api.ts:27`):** Token is stored both in `localStorage['token']` and inside `localStorage['tazatokri-auth']` (`user.token`), enlarging XSS blast radius.
2. **`0 / 36` Vegetable Photos in `public/vegetables/` (`docs/IMAGES.md:6`, `src/features/catalog/vegetableImages.ts`):** Every vegetable falls back to a green leaf + letter placeholder unless a remote `https://` `imageUrl` is manually entered.
3. **Hard-Coded Client Sample Price Data (`src/features/catalog/defaultCatalog.ts:61-427`):** `DEFAULT_CATALOG_VEGETABLES` embeds 36 `samplePrice` values (`'15.00'`, `'40.00'`, etc.) and `SAMPLE_PRICE_NOTE = 'Sample price - replace'` in the client bundle, though runtime seeding sends only `?withSamplePrices=true|false` to the backend.
4. **Hard-Coded Stock & Price Mock Handler (`src/mocks/handlers/staffCatalog.ts:6,28-48`):** When `VITE_USE_MOCKS=true` (or in Vitest MSW server), synthesizes fake catalog rows with `pricePerUnit: v.samplePrice` and `stock: '25.000'`. Currently inactive in `.env` (`VITE_USE_MOCKS` unset, `VITE_API_URL=http://localhost:8080`).
5. **Silent Client-Side Translation Dictionary Fallback (`src/hooks/useVegetableName.ts:11-62`):** `SLUG_TRANSLATIONS` silently supplies Marathi/Hindi vegetable names when backend `nameMr` / `nameHi` is blank.
6. **Hard-Coded Display Business Rules & Low-Stock Threshold (`src/lib/businessRules.ts:15-59`, `src/features/inventory/pages/StockPage.tsx:31`, `src/features/sales/components/QuickSaleTile.tsx:26`):** `MIN_ORDER_AMOUNT=150`, `DELIVERY_FEE=30`, `FREE_DELIVERY_THRESHOLD=300`, `DELIVERY_CUTOFF_HOUR=18`, `ONLINE_ORDER_EXPIRY_MINUTES=15`, and low-stock threshold `<= 5` are client constants rather than backend config, risking drift from `application.properties`.
7. **User Management Misleading Surface (`src/features/users/pages/UsersPage.tsx`):** Route is `/staff/users` for `OWNER`, yet it only fetches `GET /api/delivery/people` and cannot list `OWNER`, `STAFF`, or `CUSTOMER` accounts.
8. **Type Enum Drift (`src/features/delivery/types.ts:4`, `src/features/payments/types.ts:4-5`):** Extra `'IN_PROGRESS'`, `'UPI'`, `'SETTLED'` union members not backed by backend enums.
9. **Mobile Owner Nav Truncation & Missing Delivery Language Switcher (`src/components/layout/StaffLayout.tsx`, `DeliveryLayout.tsx`):** `navItems.slice(0, 5)` hides Owner-only links (`pricing`, `payments`, `users`) from mobile bottom nav; `DeliveryLayout` has no language switcher.
10. **Heavy Production Bundle (`vite build` output):** `index-*.js` is `300.80 kB` and `vendor-charts-*.js` (`recharts`) is `388.13 kB`.

---

## 11. Backend Read-Only Findings (`tazatokri-backend`)

Do NOT edit these from frontend work; listed for user remediation:
1. **Default DB, Flyway, JWT & Owner Credentials in `tazatokri-backend/src/main/resources/application.properties`:**
   - **Line 7:** `spring.datasource.password=${DB_APP_PASSWORD:choose-a-long-password}`
   - **Line 17:** `spring.flyway.password=${DB_PASSWORD:root}`
   - **Line 25:** `app.jwt.secret=${JWT_SECRET:tazatokri-dev-secret-change-me-in-production-0123456789}`
   - **Line 29:** `app.bootstrap.owner-name=${BOOTSTRAP_OWNER_NAME:TazaTokri Owner}`
   - **Line 30:** `app.bootstrap.owner-phone=${BOOTSTRAP_OWNER_PHONE:9999999999}`
   - **Line 31:** `app.bootstrap.owner-password=${BOOTSTRAP_OWNER_PASSWORD:Owner@123}`
2. **Startup Owner Auto-Bootstrap (`tazatokri-backend/src/main/java/com/tazatokri/auth/OwnerBootstrap.java:14-54`):**
   - Runs at startup via `CommandLineRunner`; if `!userRepository.existsByRole(Role.OWNER)`, automatically inserts an `OWNER` user using `app.bootstrap.*` properties (including the hard-coded fallback credentials above when env vars are unset).
3. **Sample Price Constants in `tazatokri-backend/src/main/java/com/tazatokri/catalog/CatalogSeedService.java:53,75-116,140-250`:**
   - No automatic startup seeding exists (`CatalogBootstrap` is absent), and sample prices (`SAMPLE_PRICE_NOTE = "Sample price - replace"`) are only inserted when an authenticated `OWNER`/`STAFF` explicitly invokes `POST /api/vegetables/seed-catalog?withSamplePrices=true`.
4. **Hard-Coded Business Rules in `application.properties` (lines 42-46):**
   - `app.delivery.serviceable-pincodes=411026,411039`, `min-order=150`, `fee=30`, `free-above=300`, `cutoff-time=18:00` are not exposed publicly to the UI.

---

## 12. Features Blocked / Limited by Current API

Detailed specifications are written in [`docs/BACKEND_REQUESTS.md`](file:///c:/Taza_Tokri/docs/BACKEND_REQUESTS.md). Key blocked capabilities:
- Full staff/owner/customer user directory, role updates, and account deactivation (`GET/PATCH /api/users`).
- Password reset / change-password flows (`auth.forgotPassword` key has no endpoint).
- Dynamic shop delivery config & pre-checkout pincode validation (`GET /api/public/config`).
- Editing a vegetable's `baseUnit` or selling `units`, uploading photos, and editing/deactivating categories & suppliers.
- Editing, deleting, or switching default customer addresses (`PUT`/`DELETE`/`PATCH /api/customer/addresses/{id}`).
- Displaying item `baseUnit` in `OrderResponse.Item` and `DailyReport` (`ItemLine`/`QtyLine`).
- Pagination metadata and order item previews in `/api/customer/orders` list, customer payment/refund status tracking, and settlement/pending-refund audit lists for Owner.

---

## 13. Baseline Check Results (Phase 0)

All four core scripts were run after all reverts and prior to writing docs:
- **`npm run typecheck` (`tsc --noEmit`):** PASS (`EXIT_TYPECHECK=0`)
- **`npm run lint` (`eslint . --max-warnings 0`):** PASS (`EXIT_LINT=0`, 0 warnings)
- **`npm test` (`vitest run`):** PASS (`EXIT_TEST=0`, **7 test files passed, 28 tests passed**, duration `6.47s`)
- **`npm run build` (`tsc -b && vite build`):** PASS (`EXIT_BUILD=0`, built in `6.74s`, `PWA v0.21.2 generateSW`, precache 76 entries / `1391.45 KiB`)
- **`npm run test:e2e` (`playwright test`):** **NOT TESTED** in Phase 0 (note: `tests/e2e/critical-flows.spec.ts` relies on `page.route` network mocks rather than live backend).

---

## 14. Git Status & Commit History

- `git -C c:\Taza_Tokri status` and `git -C c:\Taza_Tokri log -10 --oneline` -> **Failed (`exit 128`): `fatal: not a git repository (or any of the parent directories): .git`**
- `git -C c:\Taza_Tokri\tazatokri-backend status` and `git -C c:\Taza_Tokri\tazatokri-backend log -10 --oneline` -> **Failed (`exit 128`): `fatal: not a git repository (or any of the parent directories): .git`**
- Neither workspace is currently initialized as a Git repository, so commit history and tracked uncommitted-change status are **unavailable (`N/A`)**.

---

## 15. Current Status Table, Limitations & Recommended Redesign Sequence

### Current Status Table
| Area | Status | Notes |
|---|---|---|
| Core Build / Lint / Typecheck / Unit Tests | Green | 0 TS errors, 0 lint warnings, 28/28 unit tests pass |
| Public Landing & Customer Shop (`/`, `/shop`) | Functional | Trilingual fallback works; 0/36 vegetable photos present |
| Customer Checkout / Orders / Account | Functional (API-limited) | Razorpay & COD work; cannot edit/delete addresses or preview list items |
| Staff POS, Orders, Stock, Catalog, Purchases | Functional | Solid `Decimal.js` math & idempotency; seed modal has hardcoded English |
| Owner Dashboard, Pricing, Payments, Users | Partial | `UsersPage` shows delivery people only; missing unit labels in reports |
| Delivery Rider App (`/delivery`) | Functional | Mobile action ergonomics good; missing `LanguageSwitcher` & has stale enum union |
| i18n (`mr`, `hi`) Completeness | Incomplete | 119 keys missing in `mr`, 123 missing in `hi`, plus ~20 hardcoded JSX/Zod strings |
| Git Version Control & Visual Assets | Missing | Not a Git repo; `0/36` vegetable `.jpg` images in `public/vegetables/` |

### Missing APIs & Limitations Summary
See Section 12 and [`docs/BACKEND_REQUESTS.md`](file:///c:/Taza_Tokri/docs/BACKEND_REQUESTS.md) (16 backend contracts required for full parity: `/api/users`, `/api/me` enrichment, `/api/public/config`, address CRUD, vegetable unit editing, `baseUnit` on orders/reports, settlement history & refund queue preview, and pagination metadata).

### Recommended Implementation Sequence for Redesign
1. **Phase 1 — Foundation, Hygiene & Design System:**
   - Initialize Git (or confirm VCS backup) before edits; strip unused client-side `samplePrice` payloads out of production bundles (keep minimal mock fixtures under `src/mocks/` or `src/tests/` only); align TS enums (`DeliveryStatus`, `PaymentMethod`, `PaymentStatus`) with real backend enums; refine design tokens, spacing, typography, and accessible responsive shells (`StaffLayout` mobile drawer/overflow menu so `OWNER` can reach Pricing/Payments/Users on mobile; add `<LanguageSwitcher />` to `DeliveryLayout`).
2. **Phase 2 — i18n & Assets:**
   - Externalize all remaining hard-coded English JSX/Zod/toast strings into `en.json` and translate all missing keys in `mr.json` and `hi.json`; populate `public/vegetables/<slug>.jpg` photos and verify with `npm run check:images`.
3. **Phase 3 — Customer Shop & Order Experience:**
   - Elevate `/`, `/shop`, category browsing, floating cart/sticky summary, checkout address clarity, online payment countdown/status clarity, and order detail timeline within existing API limits.
4. **Phase 4 — Staff & Owner Operations:**
   - Polish Quick Sale POS (`QuickSalePage`), Order Packing/Assignment (`StaffOrdersPage` + `PackOrderDialog`), Stock/Mandi Purchases (`StockPage`, `NewPurchasePage`), Pricing (`PricingPage`), Cash Settlement (`PaymentsPage`), and Owner Dashboard (`DashboardPage`, lazy-loading/optimizing heavy chart chunk). Clarify `UsersPage` UI copy until `GET /api/users` is implemented.
5. **Phase 5 — Delivery & Quality Verification:**
   - Polish `/delivery` mobile-first ergonomics (status chips, collection clarity, call/map actions), expand Vitest/RTL & Playwright coverage against real workflows, and complete accessibility + multi-viewport verification.
