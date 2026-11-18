# TazaTokri — Grocery & Vegetable Management System

A production full-stack application for a real vegetable store (physical counter POS + online delivery shop).

---

## Monorepo Architecture

```text
Taza_Tokri/
├── frontend/                      # React 19 + TypeScript + Vite + Tailwind CSS v4 PWA
│   ├── src/                       # Components, context, pages, styles
│   ├── public/                    # 36/36 studio vegetable photos, icons, manifest
│   ├── docs/                      # Architecture, IMAGES.md (36 studio photos), API specs
│   ├── scripts/                   # Verification & helper scripts
│   ├── tests/                     # Playwright & Vitest test suites
│   ├── Dockerfile                 # Frontend production container
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                       # Spring Boot 4.1.2 + Java 21 + Maven
│   ├── src/                       # Controllers, entities, repositories, services
│   ├── pom.xml                    # Maven build configuration
│   └── mvnw                       # Maven wrapper
│
├── docker-compose.yml             # Orchestrates MySQL, Backend, and Frontend
├── .gitignore                     # Unified git ignore rules
└── README.md                      # Developer guide & onboarding
```

---

## Three Role-Based Surfaces + Public Board

| Role / Surface | Route | Design Direction & Focus |
|---|---|---|
| **CUSTOMER** | `/shop`, `/checkout`, `/orders`, `/account` | **Modern Organic** — mobile-first storefront, EN/MR/HI search, cart & free-delivery progress, Razorpay / COD checkout, order tracking & "Order again" |
| **OWNER / STAFF** | `/staff/*` | **Mandi Fresh** — Quick Sale counter POS (keypad, UPI text details, WhatsApp receipt, 5s Undo), Stock with `StockMeter` & restock list, Products tabs (Details / Pricing / Stock), Purchases with landed-cost preview, Orders workflow, Cash Settlement & Refund processing |
| **DELIVERY** | `/delivery` | **Phone-first** — day summary strip, pull-to-refresh, `Collect ₹X` / `Prepaid, collect nothing`, `tel:` & Maps links, Start / Deliver (`CASH` or `UPI_QR`) / Fail sheets |
| **PUBLIC BOARD** | `/display/prices` | Read-only chalkboard price display auto-refreshing every 60 seconds |

---

## Tech Stack

- **Frontend:** React 19 · Vite · TypeScript (strict) · React Router 7 · TanStack Query v5 · Zustand · Tailwind CSS v4 · shadcn/ui · react-hook-form + zod · react-i18next (en / mr / hi) · Recharts · Lucide Icons · vite-plugin-pwa · Vitest + RTL · Playwright.
- **Backend:** Java 21 · Spring Boot 4.1.2 · Spring Data JPA / Hibernate · Spring Security · Flyway Migrations · MySQL 8.4 · Maven.
- **Design System:** Dual theme: **Modern Organic** (customers) & **Mandi Fresh** (staff POS/inventory). 36/36 verified studio photographs on warm cream `#FAF8F2`.

---

## Getting Started

### Prerequisites
- Node.js 20+ & npm
- Java 21 JDK
- MySQL 8.4 (or Docker)

### 1. Frontend Setup
```powershell
# From root or inside frontend/:
cd frontend
npm install
copy .env.example .env
npm run dev                 # http://localhost:5173
```

### 2. Backend Setup
```powershell
cd backend
./mvnw clean spring-boot:run   # http://localhost:8080
```

### 3. Docker Compose (Full Stack)
```powershell
docker compose up -d
```

---

## Useful Commands (Root or Frontend)

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite development server |
| `npm run build` | Type-check (`tsc -b`) and build production PWA bundle |
| `npm test` | Run Vitest test suite (16 files, 73 tests) |
| `npm run lint` | ESLint verification (`--max-warnings 0`) |
| `npm run typecheck` | TypeScript strict check (`tsc --noEmit`) |
| `npm run check:images` | Verify all 36 vegetable studio photographs |
