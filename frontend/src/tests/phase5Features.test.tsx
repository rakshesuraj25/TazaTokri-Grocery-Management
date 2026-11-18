import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getLowStockThreshold, isLowStock } from '@/lib/businessRules'
import { pruneCartWithCatalog } from '@/features/cart/pruneCart'
import { matchesVegetableSearch } from '@/features/catalog/shopHelpers'
import { buildUpiString, buildWhatsAppReceiptText } from '@/features/sales/quickSaleHelpers'
import { detectSampleData } from '@/features/report/sampleDataDetector'
import { mapOrderItemsToCart } from '@/features/orders/orderAgain'
import { StatusBadge } from '@/components/StatusBadge'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import type { PublicVegetable } from '@/features/catalog/types'
import type { CartItem } from '@/features/cart/types'
import type { CurrentPriceItem } from '@/features/pricing/types'

const sampleCatalog: PublicVegetable[] = [
  {
    id: 1,
    nameEn: 'Spinach (Palak)',
    nameMr: 'पालक (Palak)',
    nameHi: 'पालक',
    category: 'Leafy Greens',
    imageUrl: null,
    baseUnit: 'BUNCH',
    pricePerUnit: '20.00',
    inStock: true,
    options: [
      { unitId: 11, label: '1 bunch', quantityInBaseUnit: '1', price: '20.00', defaultOption: true },
      { unitId: 12, label: '2 bunches', quantityInBaseUnit: '2', price: '40.00', defaultOption: false },
    ],
  },
  {
    id: 2,
    nameEn: 'Tomato',
    nameMr: 'टोमॅटो',
    nameHi: 'टमाटर',
    category: 'Everyday Vegetables',
    imageUrl: null,
    baseUnit: 'KG',
    pricePerUnit: '35.00',
    inStock: false,
    options: [
      { unitId: 21, label: '500g', quantityInBaseUnit: '0.5', price: '17.50', defaultOption: true },
    ],
  },
  {
    id: 3,
    nameEn: 'Potato (Batata)',
    nameMr: 'बटाटा',
    nameHi: 'आलू',
    category: 'Roots & Tubers',
    imageUrl: null,
    baseUnit: 'KG',
    pricePerUnit: null,
    inStock: true,
    options: [
      { unitId: 31, label: '1kg', quantityInBaseUnit: '1', price: null, defaultOption: true },
    ],
  },
]

describe('Phase 5 domain logic & accessibility checks', () => {
  it('computes low-stock thresholds correctly across base units', () => {
    expect(getLowStockThreshold('KG')).toBe(5)
    expect(getLowStockThreshold('BUNCH')).toBe(5)
    expect(getLowStockThreshold('PIECE')).toBe(5)

    expect(isLowStock('5', 'KG')).toBe(true)
    expect(isLowStock('4.5', 'KG')).toBe(true)
    expect(isLowStock('6', 'KG')).toBe(false)
    expect(isLowStock('0', 'KG')).toBe(false)
    expect(isLowStock('-1', 'BUNCH')).toBe(false)
  })

  it('prunes cart items that are out of stock, missing, or unpriced', () => {
    const cart: CartItem[] = [
      {
        vegetableId: '1',
        unitId: '11',
        unitLabel: '1 bunch',
        nameEn: 'Spinach (Palak)',
        pricePerUnit: '20.00',
        quantityInBaseUnit: '1',
        count: 2,
      },
      {
        vegetableId: '2',
        unitId: '21',
        unitLabel: '500g',
        nameEn: 'Tomato',
        pricePerUnit: '35.00',
        quantityInBaseUnit: '0.5',
        count: 1,
      },
      {
        vegetableId: '3',
        unitId: '31',
        unitLabel: '1kg',
        nameEn: 'Potato (Batata)',
        pricePerUnit: '30.00',
        quantityInBaseUnit: '1',
        count: 1,
      },
    ]

    const result = pruneCartWithCatalog(cart, sampleCatalog)
    expect(result.validItems).toHaveLength(1)
    expect(result.validItems[0]?.vegetableId).toBe('1')
    expect(result.removedItems.map((i) => i.vegetableId)).toEqual(['2', '3'])
  })

  it('matches bilingual search across EN, MR, HI ignoring case, spaces and parentheses', () => {
    const spinach = sampleCatalog[0]!
    expect(matchesVegetableSearch(spinach, '  palak  ')).toBe(true)
    expect(matchesVegetableSearch(spinach, 'पालक')).toBe(true)
    expect(matchesVegetableSearch(spinach, 'Spinach Palak')).toBe(true)
    expect(matchesVegetableSearch(sampleCatalog[2]!, 'आलू')).toBe(true)
    expect(matchesVegetableSearch(sampleCatalog[2]!, 'बटाटा')).toBe(true)
    expect(matchesVegetableSearch(spinach, 'Coriander')).toBe(false)
  })

  it('builds UPI URI cleanly only when shop UPI ID is configured', () => {
    expect(buildUpiString({ upiId: '', amount: '120' })).toBeNull()
    expect(buildUpiString({ upiId: 'shop@upi', payeeName: 'TazaTokri', amount: 120 })).toBe(
      'upi://pay?pa=shop%40upi&pn=TazaTokri&am=120.00&cu=INR',
    )
  })

  it('formats plain-text WhatsApp receipt without emojis', () => {
    const text = buildWhatsAppReceiptText({
      id: 42,
      paymentMethod: 'CASH',
      totalAmount: '85.00',
      soldBy: 1,
      createdAt: '2026-11-15T09:00:00Z',
      items: [
        { vegetableId: 1, vegetableName: 'Spinach', quantity: '2', unitPrice: '20.00', lineTotal: '40.00' },
        { vegetableId: 2, vegetableName: 'Tomato', quantity: '1.5', unitPrice: '30.00', lineTotal: '45.00' },
      ],
    })
    expect(text).toContain('TazaTokri — Bill #42')
    expect(text).toContain('Payment: CASH')
    expect(text).toContain('- Spinach: 2 x ₹20.00 = ₹40.00')
    expect(text).toContain('Total: ₹85.00')
  })

  it('flags sample data when sample note exists or purchase spend is zero', () => {
    const prices: CurrentPriceItem[] = [
      {
        vegetableId: 1,
        nameEn: 'Spinach',
        baseUnit: 'BUNCH',
        pricePerUnit: '20.00',
        source: 'MANUAL',
        note: 'Sample price - replace',
        createdAt: '2026-11-15T06:00:00Z',
      },
    ]
    const flagged = detectSampleData(prices, '0')
    expect(flagged.isFlagged).toBe(true)
    expect(flagged.reasons).toHaveLength(2)

    const clean = detectSampleData(
      [
        {
          vegetableId: 1,
          nameEn: 'Spinach',
          baseUnit: 'BUNCH',
          pricePerUnit: '24.00',
          source: 'MANUAL',
          note: null,
          createdAt: '2026-11-15T06:00:00Z',
        },
      ],
      '500.00',
    )
    expect(clean.isFlagged).toBe(false)
  })

  it('maps order-again lines and reports unmatched or out-of-stock vegetables', () => {
    const res = mapOrderItemsToCart(
      [
        {
          vegetableId: 1,
          vegetableName: 'Spinach (Palak)',
          quantity: '2',
          unitPrice: '20.00',
          estimatedLineTotal: '40.00',
          actualQuantity: null,
          finalLineTotal: null,
        },
        {
          vegetableId: 2,
          vegetableName: 'Tomato',
          quantity: '0.5',
          unitPrice: '17.50',
          estimatedLineTotal: '8.75',
          actualQuantity: null,
          finalLineTotal: null,
        },
      ],
      sampleCatalog,
    )
    expect(res.matched).toHaveLength(1)
    expect(res.matched[0]?.unitId).toBe('12')
    expect(res.skipped).toEqual(['Tomato'])
  })

  it('renders StatusBadge variants and responsive controls across 390, 768 and 1440 px viewports', () => {
    for (const width of [390, 768, 1440]) {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
      const { unmount } = render(
        <MemoryRouter>
          <div role="region" aria-label="Status showcase">
            <StatusBadge kind="stock" status="IN_STOCK" />
            <StatusBadge kind="stock" status="LOW_STOCK" />
            <StatusBadge kind="price" status="NOT_SET" />
            <StatusBadge kind="order" status="OUT_FOR_DELIVERY" />
            <LanguageSwitcher />
          </div>
        </MemoryRouter>,
      )
      expect(screen.getByRole('region', { name: 'Status showcase' })).toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeInTheDocument()
      unmount()
    }
  })
})
