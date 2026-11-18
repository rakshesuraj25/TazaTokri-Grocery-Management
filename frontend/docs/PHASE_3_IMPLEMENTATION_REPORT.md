# TazaTokri — Phase 3 Implementation Report: Shop Operations & Business Intelligence

## 1. Executive Summary

Phase 3 delivers advanced shop operations, financial & inventory intelligence, freshness batch tracking, staff-controlled markdown pricing, thermal receipt printing (`58mm`, `80mm`, and `A4`), and safe Gemini AI draft assistants for Purchase Invoices and Quick Sale customer lists—while preserving all Phase 1 and Phase 2 features and business rules.

---

## 2. Thermal Receipt Printing (Task 1)

- **Configurable Paper Widths & Store Settings (`frontend/src/features/sales/receiptSettings.ts`):**
  - Supports **`58mm`**, **`80mm`**, and **`A4`** paper widths persisted in `localStorage`.
  - Configurable store name, tagline, address, phone number, and thank-you footer message.
- **Quick Sale POS Thermal Receipt (`frontend/src/features/sales/components/SaleReceiptDialog.tsx`):**
  - Displays store header, phone, address, bill reference (`SALE-#`), timestamp, cashier reference, payment method (`CASH`/`UPI`) with `PAID` status badge, itemized rows (`qty × rate = lineTotal`), grand total, and configurable footer.
  - Inline settings editor for store metadata and paper width switcher (`58mm` / `80mm` / `A4`).
- **Customer Order Confirmation vs Payment Receipt (`frontend/src/features/orders/components/CustomerOrderReceiptDialog.tsx`):**
  - `resolveOrderDocumentKind(order)` strictly distinguishes:
    - **`PAYMENT_RECEIPT` (`PAID`)**: Only when `order.status === 'DELIVERED'` or when `order.paymentMethod === 'ONLINE'` on a confirmed/completed order.
    - **`ORDER_CONFIRMATION` (`DUE ON DELIVERY`)**: For active `COD` orders (`PLACED`, `CONFIRMED`, `PACKED`, `OUT_FOR_DELIVERY`).
    - **`UNPAID_NOTICE`**: Never displays a payment receipt for `PENDING_PAYMENT` or `CANCELLED` orders.
- **Print Styles (`frontend/src/styles/globals.css`):**
  - `@media print` rules for `.receipt-width-58mm` (`max-width: 58mm`), `.receipt-width-80mm` (`max-width: 80mm`), and `.receipt-width-a4` (`max-width: 190mm`) with `break-inside: avoid` on table rows.

---

## 3. Inventory Intelligence, Stock Movements & Profitability Formulas (Task 2)

- **Endpoint:** `GET /api/reports/intelligence?from=YYYY-MM-DD&to=YYYY-MM-DD` (`ReportController.java`, `ReportService.java`, `BusinessIntelligenceReport.java`).
- **A. Inventory Valuation:**
  - For each active vegetable:
    $$\text{Unit Landed Cost} = \frac{\sum (\text{lineCost} + \text{transportShare})}{\sum \text{purchaseQuantity}}$$
  - $\text{Estimated Inventory Value} = \max(0, \text{Current Stock}) \times \text{Unit Landed Cost}$.
  - If a vegetable has no recorded purchases, `unitLandedCost` and `estimatedValue` are `null` (`"Cost unavailable"`). Selling price is **never** used as a fallback for purchase cost.
- **B. Stock Movement Ledger:**
  - Computed directly from the append-only `stock_movements` ledger for any date range `[from, to]`:
    - **Opening Stock:** $\sum \text{quantity}$ for movements with $\text{createdAt} < \text{fromDate}$.
    - **Purchases (`+`):** $\sum \text{PURCHASE}$.
    - **Online Orders (`-`):** $-\sum (\text{ONLINE\_SALE} + \text{ONLINE\_CANCEL\_RETURN})$.
    - **Quick Sales (`-`):** $-\sum \text{SHOP\_SALE}$.
    - **Wastage (`-`):** $-\sum \text{WASTAGE}$.
    - **Adjustments (`±`):** $\sum \text{ADJUSTMENT}$.
    - **Closing Stock:** $\text{Opening} + \text{Purchases} - \text{Online Orders} - \text{Quick Sales} - \text{Wastage} \pm \text{Adjustments}$.
- **C. Sales Performance Report:**
  - Tracks **Today**, **Last 7 Days**, **Last 30 Days**, and **Custom Period** revenue.
  - Splits **Counter Sales (Quick Sale POS)** vs **Customer Delivery Orders** (excluding `CANCELLED` and `PENDING_PAYMENT` orders; zero double-counting).
  - Breaks down payment methods across `COUNTER • CASH`, `COUNTER • UPI`, `ONLINE • COD`, and `ONLINE • ONLINE`, plus top 10 best-selling vegetables.
- **D. Profit & Margin Report:**
  - $\text{Merchandise Revenue} = \text{Counter Sales Revenue} + \text{Online Order Line Totals (excluding delivery fees)}$.
  - $\text{Vegetable COGS} = \sum (\text{Sold Qty of Costed Item} \times \text{Actual Purchase Landed Cost})$.
  - $\text{Estimated Gross Profit} = \text{Costed Merchandise Revenue} - \text{Vegetable COGS}$.
  - $\text{Gross Margin \%} = \frac{\text{Estimated Gross Profit}}{\text{Costed Merchandise Revenue}} \times 100$.
  - $\text{Estimated Net Contribution} = \text{Estimated Gross Profit} - \text{Wastage Cost}$.
  - Clearly labeled as an estimate excluding shop rent, utilities, and uncosted items.
- **E. Dashboard & Stock Page Integration (`BusinessIntelligencePanel.tsx`):**
  - Integrated into `DashboardPage.tsx` and accessible from `StockPage.tsx` with `Today`, `Last 7 days`, `Last 30 days`, and `Custom` date filters.

---

## 4. Freshness Batches, Stock Loss & Staff Markdown Pricing (Task 3)

- **Freshness / Purchase Batch Tracking:**
  - Tracks real purchase batches (`PUR-#id`, supplier name, purchase date, days since purchase in `Asia/Kolkata` IST, received quantity, FIFO estimated remaining quantity capped at current stock, landed cost per unit, and current selling price) without fabricating expiry dates.
- **Structured Stock Loss / Wastage Reasons (`StockModals.tsx`, `ReportService.java`):**
  - Supports `Spoiled`, `Damaged`, `Expired`, `Trimmed`, `Returned`, and `Other`, valued at actual purchase landed cost.
- **Staff-Controlled Markdown / Clearance Pricing (`POST /api/pricing/vegetables/{id}/markdown`, `MarkdownPriceDialog.tsx`):**
  - Allows staff/owner to apply a reduced selling price on ageing, sellable stock.
  - Enforces safety guards:
    1. Rejects zero-stock items.
    2. Rejects `"Spoiled"` / `"Rotten"` reasons (spoiled stock must be recorded as Wastage, never sold on clearance).
    3. Requires `markdownPricePerUnit < currentPrice`.
    4. Records price history with note `"Markdown: <reason> (was ₹<oldPrice>)"`.

---

## 5. Gemini AI Architecture, Configuration & Safety Boundaries (Tasks 4 & 5)

- **Backend Package:** `com.tazatokri.ai` (`GeminiProvider.java`, `AiAssistantService.java`, `AiAssistantController.java`, `AiDtos.java`, `AiExtractionLog.java`, `AiExtractionLogRepository.java`).
- **Database Migration:** `V3__phase3_operations_and_intelligence.sql` (`ai_extraction_logs` audit table).
- **Environment Configuration (`application.properties`):**
  - `GEMINI_ENABLED` (`app.gemini.enabled`, default `false`)
  - `GEMINI_API_KEY` (`app.gemini.api-key`, backend-only; never exposed to the browser)
  - `GEMINI_MODEL` (`app.gemini.model`, default `gemini-4-hydrogen`)
  - `GEMINI_MAX_UPLOAD_BYTES` (`app.gemini.max-upload-bytes`, default `5242880` = 5 MB)
- **Strict Draft-Only Safety Boundary:**
  - **Task 4 — AI Purchase Invoice Scanner (`POST /api/ai/purchase-invoice/extract`, `InvoiceScannerCard.tsx`):**
    - Accepts JPEG, PNG, WebP, or PDF invoices (`<= 5 MB`) or pasted supplier bill text.
    - Extracts supplier name (matching existing suppliers), invoice date, invoice number, transport cost, and vegetable lines.
    - Matches lines against the 36-vegetable catalog (English, Marathi, Hindi, and phonetic synonyms), recalculates line totals and grand total, flags total mismatches (`totalMismatchWarning`) and unmatched items, and requires staff to map or remove unmatched lines before loading into `NewPurchasePage.tsx`. **Never auto-saves a purchase or updates stock.**
  - **Task 5 — AI Customer List to Quick Sale (`POST /api/ai/quick-sale/extract`, `AiQuickSaleAssistantDialog.tsx`):**
    - Accepts typed/pasted customer grocery lists in English, Marathi, or Hindi (e.g. `"2 kg onion\n500 g tomato\n1 bunch kothimbir"`) or uploaded handwritten list images.
    - Converts gram quantities (`500 g` -> `0.500 KG`), attaches current selling prices and available stock, flags out-of-stock or unmatched items, and loads confirmed items into the Quick Sale POS draft bill. **Never auto-creates a sale or deducts stock.**
