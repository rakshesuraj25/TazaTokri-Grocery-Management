import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import enLocale from '@/i18n/locales/en.json'
import mrLocale from '@/i18n/locales/mr.json'
import hiLocale from '@/i18n/locales/hi.json'
import { matchesVegetableSearch } from '@/features/catalog/shopHelpers'
import type { PublicVegetable, StaffCatalogItem } from '@/features/catalog/types'
import { QuickSaleTile } from '@/features/sales/components/QuickSaleTile'
import { PriceSuggestionDialog } from '@/features/pricing/components/PricingDialogs'
import ChalkboardPriceBoardPage from '@/features/pricing/pages/ChalkboardPriceBoardPage'
import DashboardPage from '@/features/report/pages/DashboardPage'

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, next))
    } else {
      keys.push(next)
    }
  }
  return keys
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const okraVeg: PublicVegetable = {
  id: 8,
  nameEn: 'Okra (Bhendi)',
  nameMr: 'भेंडी',
  nameHi: 'भिंडी',
  category: 'Everyday Vegetables',
  imageUrl: null,
  baseUnit: 'KG',
  pricePerUnit: '60.00',
  inStock: true,
  options: [
    { unitId: 1, label: '250g', quantityInBaseUnit: '0.250', price: '15.00', defaultOption: false },
    { unitId: 2, label: '500g', quantityInBaseUnit: '0.500', price: '30.00', defaultOption: true },
  ],
}

const staffTomato: StaffCatalogItem = {
  id: 1,
  nameEn: 'Tomato',
  nameMr: 'टोमॅटो',
  nameHi: 'टमाटर',
  category: 'Everyday Vegetables',
  imageUrl: null,
  baseUnit: 'KG',
  pricePerUnit: '40.00',
  stock: '12.000',
  available: true,
  options: [
    { unitId: 101, label: '250g', quantityInBaseUnit: '0.250', defaultOption: false },
    { unitId: 102, label: '500g', quantityInBaseUnit: '0.500', defaultOption: true },
    { unitId: 103, label: '1 kg', quantityInBaseUnit: '1.000', defaultOption: false },
  ],
}

describe('Phase H — Redesign, i18n parity & screen regressions', () => {
  it('maintains 100% translation key parity between en, mr and hi locales', () => {
    const enKeys = new Set(flattenKeys(enLocale as Record<string, unknown>))
    const mrKeys = new Set(flattenKeys(mrLocale as Record<string, unknown>))
    const hiKeys = new Set(flattenKeys(hiLocale as Record<string, unknown>))

    const missingMr = [...enKeys].filter((k) => !mrKeys.has(k))
    const missingHi = [...enKeys].filter((k) => !hiKeys.has(k))

    expect(missingMr).toEqual([])
    expect(missingHi).toEqual([])
  })

  it('matches transliterated Hindi/Marathi names in shop search', () => {
    expect(matchesVegetableSearch(okraVeg, 'bhindi')).toBe(true)
    expect(matchesVegetableSearch(okraVeg, 'bhendi')).toBe(true)
    expect(matchesVegetableSearch(okraVeg, 'भिंडी')).toBe(true)
    expect(matchesVegetableSearch(okraVeg, 'tomato')).toBe(false)
  })

  it('renders QuickSaleTile size chips without truncation and highlights the active unit', () => {
    const onAddQty = vi.fn()
    wrap(
      <QuickSaleTile
        item={staffTomato}
        inBillQty="0.250"
        onAddQty={onAddQty}
        onToggleAvailable={vi.fn()}
      />,
    )

    const chip250 = screen.getByRole('button', { name: '250g' })
    const chip500 = screen.getByRole('button', { name: '500g' })
    expect(chip250.querySelector('span')?.className ?? '').not.toContain('truncate')
    expect(chip500.querySelector('span')?.className ?? '').not.toContain('truncate')

    fireEvent.click(chip250)
    expect(onAddQty).toHaveBeenCalledWith(staffTomato, '0.250')
    expect(chip250).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows current price alongside suggested price breakdown in PriceSuggestionDialog', async () => {
    server.use(
      http.get('*/api/pricing/vegetables/1/suggestion', () =>
        HttpResponse.json({
          vegetableId: 1,
          vegetableName: 'Tomato',
          averageLandedCost: '28.50',
          wastagePercent: '8.0',
          costWithWastage: '30.98',
          marginPercent: '25.0',
          suggestedPrice: '41.30',
        }),
      ),
    )

    wrap(<PriceSuggestionDialog vegetable={staffTomato} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('₹41.30')).toBeInTheDocument()
    })
    expect(screen.getByText('₹28.50')).toBeInTheDocument()
    expect(screen.getByText('₹40.00')).toBeInTheDocument()
  })

  it('renders ChalkboardPriceBoardPage with bilingual toggle and public rates', async () => {
    server.use(
      http.get('*/api/public/vegetables', () => HttpResponse.json([okraVeg])),
    )

    wrap(<ChalkboardPriceBoardPage />)

    await waitFor(() => {
      expect(screen.getByText(/Okra \(Bhendi\)/i)).toBeInTheDocument()
    })
    expect(screen.getByText('₹60.00')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /मराठी/i })).toBeInTheDocument()
  })

  it('renders Owner Dashboard operational cards and alerts cleanly without mock data', async () => {
    server.use(
      http.get('*/api/reports/daily', () =>
        HttpResponse.json({
          date: '2026-11-15',
          totalSales: '3450.00',
          totalBills: 18,
          averageBill: '191.67',
          purchaseSpend: '2100.00',
          byPayment: [{ method: 'CASH', total: '2200.00', bills: 12 }],
          topItems: [{ vegetableId: 1, name: 'Tomato', revenue: '1200.00', quantity: '30.000' }],
          wastage: [],
          stock: [{ vegetableId: 1, name: 'Tomato', quantity: '3.000' }],
        }),
      ),
      http.get('*/api/pricing/current', () =>
        HttpResponse.json([
          {
            vegetableId: 1,
            nameEn: 'Tomato',
            baseUnit: 'KG',
            pricePerUnit: '40.00',
            source: 'MANUAL',
            note: null,
            createdAt: '2026-11-15T06:00:00Z',
          },
        ]),
      ),
      http.get('*/api/vegetables', () =>
        HttpResponse.json([{ ...staffTomato, stock: '3.000' }]),
      ),
      http.get('*/api/orders', () => HttpResponse.json([])),
      http.get('*/api/purchases', () => HttpResponse.json([])),
      http.get('*/api/payments/cash-pending', () => HttpResponse.json([])),
    )

    wrap(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('₹3,450.00')).toBeInTheDocument()
    })
    expect(screen.getByText(/Low & out-of-stock alerts/i)).toBeInTheDocument()
    expect(screen.getByText(/Cash settlements & refunds/i)).toBeInTheDocument()
  })
})
