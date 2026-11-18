import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import { VEGETABLE_SYNONYM_ENTRIES, VEGETABLE_SYNONYMS } from '@/data/vegetable-synonyms'
import {
  filterVegetablesBySearch,
  matchesVegetableSearch,
  normalizeDevanagari,
  normalizeSearchText,
  toPhoneticKey,
} from '@/utils/vegetable-search'
import { DEFAULT_CATALOG_VEGETABLES } from '@/features/catalog/defaultCatalog'
import { VegetableCard } from '@/features/catalog/components/VegetableCard'
import { pruneCartWithCatalog } from '@/features/cart/pruneCart'
import { useCartStore } from '@/features/cart/store'
import {
  getLowStockThreshold,
  getLowStockThresholds,
  getStockStatus,
  isLowStock,
  isOutOfStock,
  resetLowStockThresholds,
  setLowStockThresholds,
} from '@/lib/businessRules'
import { calculateReceiptSummary, buildWhatsAppReceiptText } from '@/features/sales/quickSaleHelpers'
import { SaleReceiptDialog } from '@/features/sales/components/SaleReceiptDialog'
import { WastageDialog } from '@/features/inventory/components/StockModals'

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Phase 1 — Core Stabilization, Multilingual Search, Stock Alerts, Wastage & Receipt', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], clientRef: 'test-ref-1' })
    resetLowStockThresholds()
  })

  describe('Task 2: Marathi, Hindi, Transliteration & Phonetic Vegetable Search', () => {
    it('covers all 36 catalog vegetables in the synonym dictionary', () => {
      expect(Object.keys(VEGETABLE_SYNONYM_ENTRIES)).toHaveLength(36)
      expect(Object.keys(VEGETABLE_SYNONYMS)).toHaveLength(36)
    })

    it('normalizes Unicode text, extra spaces, punctuation, Devanagari matras, and phonetic keys', () => {
      expect(normalizeSearchText('  Fresh   Coriander (Kothimbir)!  ')).toBe(
        'fresh coriander kothimbir',
      )
      expect(normalizeDevanagari('पुदीना')).toBe(normalizeDevanagari('पुदिना'))
      expect(normalizeDevanagari('लसूण')).toBe(normalizeDevanagari('लसुण'))
      expect(toPhoneticKey('kothimbeer')).toBe(toPhoneticKey('kotimbir'))
      expect(toPhoneticKey('bhindee')).toBe(toPhoneticKey('bhindi'))
      expect(toPhoneticKey('bhendee')).toBe(toPhoneticKey('bhendi'))
      expect(toPhoneticKey('vaangi')).toBe(toPhoneticKey('wangi'))
    })

    it('matches all required Marathi, Hindi, and transliterated search queries from specification', () => {
      const catalog = DEFAULT_CATALOG_VEGETABLES.map((v, idx) => ({
        id: idx + 1,
        nameEn: v.nameEn,
        nameMr: v.nameMr,
        nameHi: v.nameHi,
      }))

      const requiredCases: Array<[string, string]> = [
        ['kothimbir', 'Fresh Coriander'],
        ['कोथिंबीर', 'Fresh Coriander'],
        ['dhaniya', 'Fresh Coriander'],
        ['धनिया', 'Fresh Coriander'],
        ['kanda', 'Onion (Kanda)'],
        ['कांदा', 'Onion (Kanda)'],
        ['pyaz', 'Onion (Kanda)'],
        ['प्याज', 'Onion (Kanda)'],
        ['batata', 'Potato (Batata)'],
        ['बटाटा', 'Potato (Batata)'],
        ['aloo', 'Potato (Batata)'],
        ['आलू', 'Potato (Batata)'],
        ['methi', 'Fenugreek (Methi)'],
        ['मेथी', 'Fenugreek (Methi)'],
        ['palak', 'Spinach (Palak)'],
        ['पालक', 'Spinach (Palak)'],
        ['bhendi', 'Okra (Bhendi)'],
        ['भेंडी', 'Okra (Bhendi)'],
        ['भिंडी', 'Okra (Bhendi)'],
        ['vangi', 'Brinjal (Vangi)'],
        ['वांगी', 'Brinjal (Vangi)'],
        ['baingan', 'Brinjal (Vangi)'],
        ['बैंगन', 'Brinjal (Vangi)'],
      ]

      for (const [query, expectedNameEn] of requiredCases) {
        const results = filterVegetablesBySearch(catalog, query)
        const matchedNames = results.map((r) => r.nameEn)
        expect(
          matchedNames,
          `Expected query "${query}" to match "${expectedNameEn}"`,
        ).toContain(expectedNameEn)
      }
    })

    it('supports phonetic spelling variations and never returns duplicate vegetables', () => {
      const catalog = DEFAULT_CATALOG_VEGETABLES.map((v, idx) => ({
        id: idx + 1,
        nameEn: v.nameEn,
        nameMr: v.nameMr,
        nameHi: v.nameHi,
      }))

      expect(matchesVegetableSearch(catalog[0], 'kothimbeer')).toBe(true)
      expect(matchesVegetableSearch(catalog[0], 'kotimbir')).toBe(true)

      const duplicateInput = [catalog[0], catalog[0]]
      const deduped = filterVegetablesBySearch(duplicateInput, 'kothimbir')
      expect(deduped).toHaveLength(1)
    })
  })

  describe('Task 3: Low-Stock & Out-of-Stock Alerts and Customer Stock Capping', () => {
    it('computes stock status and respects configurable low-stock thresholds', () => {
      expect(isOutOfStock(0)).toBe(true)
      expect(isOutOfStock('-1')).toBe(true)
      expect(isOutOfStock('2.5')).toBe(false)

      expect(getStockStatus('0', 'KG')).toBe('OUT_OF_STOCK')
      expect(getStockStatus('5', 'KG')).toBe('LOW_STOCK')
      expect(getStockStatus('5.5', 'KG')).toBe('IN_STOCK')

      setLowStockThresholds({ KG: 10, BUNCH: 8, PIECE: 6 })
      expect(getLowStockThresholds()).toEqual({ KG: 10, BUNCH: 8, PIECE: 6 })
      expect(getLowStockThreshold('KG')).toBe(10)
      expect(isLowStock('8', 'KG')).toBe(true)
      expect(isLowStock('12', 'KG')).toBe(false)
    })

    it('prevents customers from adding quantities above availableStock in VegetableCard and pruneCartWithCatalog', () => {
      const veg = {
        id: 10,
        nameEn: 'Tomato',
        nameMr: 'टोमॅटो',
        nameHi: 'टमाटर',
        category: 'Everyday Vegetables',
        baseUnit: 'KG' as const,
        pricePerUnit: '40.00',
        inStock: true,
        availableStock: '0.750', // Only 750g in stock
        options: [
          { unitId: 101, label: '250g', quantityInBaseUnit: '0.250', price: '10.00', defaultOption: false },
          { unitId: 102, label: '500g', quantityInBaseUnit: '0.500', price: '20.00', defaultOption: true },
          { unitId: 103, label: '1kg', quantityInBaseUnit: '1.000', price: '40.00', defaultOption: false },
        ],
      }

      renderWithProviders(<VegetableCard vegetable={veg} />)

      // 1kg option exceeds total availableStock (0.750 kg), so its radio chip is disabled
      const oneKgRadio = screen.getByRole('radio', { name: '1kg' })
      expect(oneKgRadio).toBeDisabled()

      // Default 500g option can be added once (0.500 <= 0.750)
      const addBtn = screen.getByRole('button', { name: /add/i })
      fireEvent.click(addBtn)

      // Adding another 500g would require 1.000 kg > 0.750 kg, so Increase button is disabled
      const incBtn = screen.getByRole('button', { name: /increase/i })
      expect(incBtn).toBeDisabled()

      // Prune helper clamps cart item count when availableStock drops
      const pruned = pruneCartWithCatalog(
        [
          {
            vegetableId: '10',
            unitId: '101',
            count: 5, // 5 * 0.250 = 1.250 kg > 0.750 kg
            nameEn: 'Tomato',
            unitLabel: '250g',
            pricePerUnit: '10.00',
            quantityInBaseUnit: '0.250',
          },
        ],
        [veg],
      )
      expect(pruned.validItems).toHaveLength(1)
      expect(pruned.validItems[0].count).toBe(3) // Clamped to 3 * 0.250 = 0.750 kg
    })
  })

  describe('Task 4: Wastage Dialog Reasons & Stock Validation', () => {
    it('displays Spoiled, Damaged, Expired and Other reasons in WastageDialog', () => {
      renderWithProviders(
        <WastageDialog
          vegetable={{
            id: 1,
            nameEn: 'Tomato',
            category: 'Everyday Vegetables',
            baseUnit: 'KG',
            pricePerUnit: '40.00',
            stock: '5.000',
            available: true,
            options: [],
          }}
          onClose={() => {}}
        />,
      )

      expect(screen.getByRole('radio', { name: /spoiled/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /damaged/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /expired/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /other/i })).toBeInTheDocument()
    })
  })

  describe('Task 5: Quick Sale Receipt Calculations & Printable Receipt Layout', () => {
    it('calculates receipt subtotal, discount, and final amount and renders print button', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

      const sale = {
        id: 108,
        createdAt: '2026-11-18T10:30:00',
        paymentMethod: 'UPI' as const,
        totalAmount: '95.00',
        soldBy: 1,
        items: [
          {
            vegetableId: 1,
            vegetableName: 'Fresh Coriander',
            baseUnit: 'BUNCH' as const,
            quantity: '2',
            unitPrice: '15.00',
            lineTotal: '30.00',
          },
          {
            vegetableId: 2,
            vegetableName: 'Potato (Batata)',
            baseUnit: 'KG' as const,
            quantity: '2',
            unitPrice: '35.00',
            lineTotal: '70.00',
          },
        ],
      }

      const summary = calculateReceiptSummary(sale)
      expect(summary.receiptNumber).toBe('#108')
      expect(summary.itemCount).toBe(2)
      expect(summary.subtotal).toBe('100.00')
      expect(summary.hasDiscount).toBe(true)
      expect(summary.discount).toBe('5.00')
      expect(summary.finalAmount).toBe('95.00')

      const waText = buildWhatsAppReceiptText(sale)
      expect(waText).toContain('TazaTokri — Bill #108')
      expect(waText).toContain('Payment: UPI')

      renderWithProviders(<SaleReceiptDialog sale={sale} onClose={() => {}} />)

      const receipt = screen.getByTestId('sale-receipt')
      expect(receipt).toHaveTextContent('TazaTokri')
      expect(receipt).toHaveTextContent('#108')
      expect(receipt).toHaveTextContent('UPI')
      expect(receipt).toHaveTextContent('Fresh Coriander')
      expect(receipt).toHaveTextContent('Potato (Batata)')
      expect(receipt).toHaveTextContent(/thank you/i)

      const printBtn = screen.getByRole('button', { name: /print receipt/i })
      fireEvent.click(printBtn)
      expect(printSpy).toHaveBeenCalledTimes(1)

      printSpy.mockRestore()
    })
  })
})
