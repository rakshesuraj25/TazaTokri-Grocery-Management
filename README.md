# TazaTokri — Frontend

Business app for a real vegetable shop (physical counter + online delivery).
One React app, three experiences, routed by role after login, plus a public counter display:

| Role / Surface | Route | Design Direction & Focus |
|---|---|---|
| CUSTOMER | `/shop`, `/checkout`, `/orders`, `/account` | **Modern Organic** — mobile-first storefront, EN/MR/HI search, cart & free-delivery progress, Razorpay / COD checkout, order tracking & "Order again" |
| OWNER / STAFF | `/staff/*` | **Mandi Fresh** — Quick Sale counter POS (keypad, UPI text details, WhatsApp receipt, 5s Undo), Stock with `StockMeter` & restock list, Products tabs (Details / Pricing / Stock), Purchases with landed-cost preview, Orders workflow, Cash Settlement & Refund processing |
| DELIVERY | `/delivery` | **Phone-first** — day summary strip, pull-to-refresh, `Collect ₹X` / `Prepaid, collect nothing`, `tel:` & Maps links, Start / Deliver (`CASH` or `UPI_QR`) / Fail sheets |
| PUBLIC BOARD | `/display/prices` | Read-only chalkboard price display auto-refreshing every 60 seconds |

Users with several roles get a role switcher in the header.

## Stack

React 19 · Vite · TypeScript (strict) · React Router (data router, lazy routes) · TanStack Query ·
Zustand (auth + cart + favourites) · Tailwind CSS v4 + shadcn/ui · react-hook-form + zod · react-i18next (en / mr / hi) ·
Recharts · sonner · date-fns (Asia/Kolkata) · vite-plugin-pwa · Vitest + RTL · Playwright.

## Getting started

```powershell
npm install
copy .env.example .env      # VITE_API_URL=http://localhost:8080
npm run dev                 # http://localhost:5173
```

Optional environment variables in `.env`:

- `VITE_API_URL` — Spring Boot backend base URL (`tazatokri-backend/`)
- `VITE_SHOP_UPI_ID` — Shop UPI VPA displayed as text + `upi://pay` URI during counter `UPI` billing
- `VITE_USE_MOCKS=true` — Only for offline dev when backend is stopped (default `false`)

| Script | Purpose |
|---|---|
| `npm run dev` | Local Vite dev server |
| `npm run build` | Type-check (`tsc -b`) + production PWA build |
| `npm run test` | Vitest unit & component tests |
| `npm run test:e2e` | Playwright critical flows |
| `npm run lint` / `npm run typecheck` | ESLint (`--max-warnings 0`) and TypeScript check |

## Project layout

```
src/
  app/            router, providers, App
  components/     shared UI (Logo, StatusBadge, StockMeter, PriceTag, Stat, EmptyState, layouts, guards)
  features/<x>/   api.ts · hooks.ts · types.ts · components/ · pages/
                  (auth, catalog, inventory, purchase, pricing, sales, report,
                   orders, delivery, payments, users, cart, landing)
  hooks/          cross-feature hooks (e.g. useVegetableName)
  i18n/           i18next setup + en/mr/hi JSON (see docs/I18N_REVIEW.md)
  lib/            api client, decimal math (money.ts), IST dates, businessRules.ts, categoryTheme.ts
  styles/         Tailwind v4 design tokens & Modern Organic / Mandi Fresh typography
```

## Rules this codebase follows

- **Backend is authoritative** for stock, selling prices, order totals, delivery fees, and status transitions. Frontend totals/landed-cost previews are display-only and labelled *Estimated* or *Display-only*.
- **One API client** (`src/lib/api.ts`) storing JWT solely under `localStorage` key `token`.
- **401** clears session and redirects to `/login?expired=1`; **403** renders Forbidden page.
- **Idempotency**: sales and orders generate a `clientRef` UUID once per attempt, reuse it on retries, and rotate only after success.
- **No sample prices or client-side seeding**: catalog seeding only runs if the owner explicitly triggers and confirms it from `/staff/catalog`.
- **Images**: self-hosted photos go in `public/vegetables/<slug>.jpg`; missing images render a category-coloured `VegetablePlaceholder` illustration (see `docs/IMAGES.md`).

## Theming & Styleguide

Design tokens live in `src/styles/globals.css` (light + dark, Fraunces serif display headings + sans/Devanagari UI fonts). A dev-only component showcase is available at `/dev/styleguide`.
