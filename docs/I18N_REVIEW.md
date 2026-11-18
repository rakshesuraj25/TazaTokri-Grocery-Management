# i18n Native Review List (`mr` & `hi`)

All `525` translation keys in `src/i18n/locales/en.json` now have corresponding entries in `mr.json` and `hi.json` (0 missing keys across the final UI/UX redesign). Before store launch, a native Marathi (`mr`) and Hindi (`hi`) speaker familiar with local vegetable-market counter phrasing should review the specialist business, ledger, and payment terms below:

| Key | English (`en`) | Current `mr` / `hi` Status | Notes for Reviewer |
|---|---|---|---|
| `staff.sale.upiScanNotice` | Customer scans, then staff confirm payment received | Drafted in `mr` & `hi` | Verify idiomatic counter phrasing for QR scan + confirmation. |
| `staff.sale.upiIdNotConfigured` | Set VITE_SHOP_UPI_ID to show store UPI payment details. | Drafted in `mr` & `hi` | Internal setup notice shown when `VITE_SHOP_UPI_ID` is unset. |
| `staff.payments.processRefunds` / `refundsListNote` | Process Pending Refunds / lookup note | Drafted in `mr` & `hi` | Verify phrasing for online order Razorpay refund processing. |
| `staff.orders.overLimit` | Hint: over 20% of ordered quantity (server enforces limit) | Drafted in `mr` & `hi` | Verify phrasing for counter packing weight variance limit. |
| `staff.stock.adjustWarning` | Stock adjustments are permanent. The wrong entry cannot be edited — add a correcting adjustment. | Drafted in `mr` & `hi` | Append-only accounting ledger warning shown to `OWNER`. |
| `staff.pricing.landedCost` / `wastageAdj` | Avg landed cost / Wastage adjustment | Drafted (`पडताळणी दर` / `औसत लागत`) | Verify local mandi terminology (`पडताळणी दर` vs `खरेदी + वाहतूक खर्च`). |
| `staff.dashboard.noPurchaseNote` | Purchase spend is total cost, not profit | Drafted in `mr` & `hi` | Ensure staff/owner wording unambiguously separates purchase cost from profit. |
| `delivery.upiReferenceRequired` | Enter the UPI transaction reference (at least 4 characters). | Drafted in `mr` & `hi` | Rider prompt for UTR / UPI transaction reference. |
| `shop.pickedFresh` | Picked fresh today, {{date}} | Drafted in `mr` & `hi` | Review seasonal tagline tone for local Pune/Maharashtra audience. |
| `shop.editorialHeroTitle` / `trustWeightBody` | Freshness for every home / Final bill weight guarantee | Drafted in `mr` & `hi` | Review warmth and clarity for everyday & first-time online buyers. |
| `staff.dashboard.sampleBannerExplain` | Conservative sample-data explanation | Drafted in `mr` & `hi` | Verify owner clarity separating sample test detection from store prices. |
| `orders.finalBillNote` | Final bill is calculated from the actual weight packed | Drafted in `mr` & `hi` | Review wording regarding post-packing exact weight adjustment. |

> Vegetable catalog names (`nameEn`, `nameMr`, `nameHi`) and selling unit labels (`250g`, `1 bunch`, etc.) come directly from the backend `/api/vegetables` / `/api/public/vegetables` payloads and are not translated on the client.
