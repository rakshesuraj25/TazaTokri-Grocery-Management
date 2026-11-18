import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import i18n from '@/i18n'
import { matchesVegetableSearch, sortPublicVegetables } from '@/features/catalog/shopHelpers'
import type { PublicVegetable, StaffCatalogItem, VegetableResponse } from '@/features/catalog/types'
import { pruneCartWithCatalog } from '@/features/cart/pruneCart'
import type { CartItem } from '@/features/cart/types'
import { buildDashboardAttentionItems } from '@/features/report/dashboardHelpers'
import { WeaveDivider } from '@/components/WeaveDivider'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import CatalogPage from '@/features/catalog/pages/CatalogPage'
import type { OrderResponse } from '@/features/orders/types'

function wrap(ui: React.ReactElement, initialRoute = '/') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const samplePublic: PublicVegetable[] = [
  {
    id: 1,
    nameEn: 'Tomato',
    nameMr: 'टोमॅटो',
    nameHi: 'टमाटर',
    category: 'Everyday Vegetables',
    baseUnit: 'KG',
    pricePerUnit: '45.00',
    inStock: true,
    options: [{ unitId: 11, label: '500g', quantityInBaseUnit: '0.500', price: '22.50', defaultOption: true }],
  },
  {
    id: 2,
    nameEn: 'Amaranth (Math)',
    nameMr: 'माठ',
    nameHi: 'चौलाई',
    category: 'Leafy Greens',
    baseUnit: 'BUNCH',
    pricePerUnit: '20.00',
    inStock: true,
    options: [{ unitId: 21, label: '1 bunch', quantityInBaseUnit: '1.000', price: '20.00', defaultOption: true }],
  },
  {
    id: 3,
    nameEn: 'Yam (Suran)',
    nameMr: 'सुरण',
    nameHi: 'सूरन',
    category: 'Roots & Tubers',
    baseUnit: 'KG',
    pricePerUnit: null,
    inStock: false,
    options: [{ unitId: 31, label: '1 kg', quantityInBaseUnit: '1.000', price: null, defaultOption: true }],
  },
]

describe('Visual Redesign v2 — Helpers, Shared Primitives & Filters', () => {
  it('sorts loaded public vegetables by name and price placing unpriced items last', () => {
    const byName = sortPublicVegetables(samplePublic, 'name', (v) => v.nameEn)
    expect(byName.map((v) => v.nameEn)).toEqual(['Amaranth (Math)', 'Tomato', 'Yam (Suran)'])

    const byPriceAsc = sortPublicVegetables(samplePublic, 'priceAsc', (v) => v.nameEn)
    expect(byPriceAsc.map((v) => v.nameEn)).toEqual(['Amaranth (Math)', 'Tomato', 'Yam (Suran)'])

    const byPriceDesc = sortPublicVegetables(samplePublic, 'priceDesc', (v) => v.nameEn)
    expect(byPriceDesc.map((v) => v.nameEn)).toEqual(['Tomato', 'Amaranth (Math)', 'Yam (Suran)'])
  })

  it('matches Marathi, Hindi and Indian market spelling queries across catalog', () => {
    expect(matchesVegetableSearch(samplePublic[1]!, 'chaulai')).toBe(true)
    expect(matchesVegetableSearch(samplePublic[1]!, 'माठ')).toBe(true)
    expect(matchesVegetableSearch(samplePublic[0]!, 'tamatar')).toBe(true)
    expect(matchesVegetableSearch(samplePublic[2]!, 'jimikand')).toBe(true)
  })

  it('prunes unavailable, missing, or unpriced cart lines cleanly', () => {
    const cart: CartItem[] = [
      {
        vegetableId: '1',
        unitId: '11',
        unitLabel: '500g',
        nameEn: 'Tomato',
        pricePerUnit: '45.00',
        quantityInBaseUnit: '0.500',
        count: 1,
      },
      {
        vegetableId: '3',
        unitId: '31',
        unitLabel: '1 kg',
        nameEn: 'Yam (Suran)',
        pricePerUnit: '60.00',
        quantityInBaseUnit: '1.000',
        count: 1,
      },
      {
        vegetableId: '999',
        unitId: '991',
        unitLabel: '1 kg',
        nameEn: 'Deleted Veg',
        pricePerUnit: '10.00',
        quantityInBaseUnit: '1.000',
        count: 1,
      },
    ]

    const result = pruneCartWithCatalog(cart, samplePublic)
    expect(result.validItems.map((i) => i.vegetableId)).toEqual(['1'])
    expect(result.removedItems.map((i) => i.vegetableId)).toEqual(['3', '999'])
  })

  it('builds complete Owner Needs Attention items for stock, pricing, waiting orders, cash, refunds and photos', () => {
    const staffCatalog: StaffCatalogItem[] = [
      {
        id: 1,
        nameEn: 'Spinach',
        category: 'Leafy Greens',
        baseUnit: 'BUNCH',
        pricePerUnit: null,
        stock: '0',
        available: true,
        options: [],
      },
      {
        id: 2,
        nameEn: 'Onion',
        category: 'Roots & Tubers',
        baseUnit: 'KG',
        pricePerUnit: '35.00',
        stock: '3.000',
        available: true,
        options: [],
      },
    ]
    const orders: OrderResponse[] = [
      {
        id: 10,
        status: 'PLACED',
        paymentMethod: 'COD',
        subtotal: '150.00',
        estimatedTotal: '180.00',
        finalTotal: null,
        deliveryFee: '30.00',
        deliveryDate: '2026-11-16',
        deliveryAddress: 'Line 1',
        deliveryPincode: '411038',
        createdAt: '2026-11-16T08:00:00Z',
        items: [],
      },
      {
        id: 11,
        status: 'CANCELLED',
        paymentMethod: 'ONLINE',
        subtotal: '240.00',
        estimatedTotal: '240.00',
        finalTotal: null,
        deliveryFee: '0.00',
        deliveryDate: '2026-11-16',
        deliveryAddress: 'Line 2',
        deliveryPincode: '411038',
        createdAt: '2026-11-16T08:15:00Z',
        items: [],
      },
    ]

    const attention = buildDashboardAttentionItems({
      catalog: staffCatalog,
      orders,
      cashHeldAmounts: ['450.00'],
      missingPhotosCount: 36,
      totalPhotoTargets: 36,
      t: i18n.t.bind(i18n),
    })

    expect(attention.map((a) => a.id)).toEqual([
      'stock',
      'pricing',
      'orders',
      'cash',
      'refunds',
      'images',
    ])
    expect(attention.find((a) => a.id === 'refunds')?.to).toBe('/staff/payments')
    expect(attention.find((a) => a.id === 'pricing')?.to).toBe('/staff/pricing')
  })

  it('renders WeaveDivider, PageHeader, and StatusBadge with non-colour icon + text', () => {
    const { container } = render(
      <div>
        <PageHeader title="Today's Rates" count={12} weave />
        <WeaveDivider variant="chalkboard" />
        <StatusBadge kind="stock" status="IN_STOCK" />
        <StatusBadge kind="stock" status="OUT_OF_STOCK" />
      </div>,
    )

    expect(screen.getByRole('heading', { name: "Today's Rates" })).toBeInTheDocument()
    expect(screen.getAllByTestId('weave-divider').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelectorAll('[data-testid="status-badge"] svg').length).toBe(2)
  })

  it('renders CustomerLayout mobile bottom bar with Shop, Orders, Cart, Account links', () => {
    wrap(<CustomerLayout />)
    const mobileNav = within(screen.getByTestId('customer-mobile-nav'))
    expect(mobileNav.getByRole('link', { name: /Shop/i })).toBeInTheDocument()
    expect(mobileNav.getByRole('link', { name: /My Orders/i })).toBeInTheDocument()
    expect(mobileNav.getByRole('link', { name: /Cart/i })).toBeInTheDocument()
    expect(mobileNav.getByRole('link', { name: /Log in|Account/i })).toBeInTheDocument()
  })

  it('filters Staff Catalog cleanly by All, Available today, Out of stock, and No price', async () => {
    const vegList: VegetableResponse[] = [
      {
        id: 1,
        nameEn: 'Spinach',
        categoryId: 1,
        categoryName: 'Leafy Greens',
        baseUnit: 'BUNCH',
        active: true,
        available: true,
        units: [{ id: 10, label: '1 bunch', quantityInBaseUnit: '1.000', defaultOption: true }],
      },
      {
        id: 2,
        nameEn: 'Brinjal',
        categoryId: 2,
        categoryName: 'Everyday Vegetables',
        baseUnit: 'KG',
        active: true,
        available: false,
        units: [{ id: 20, label: '500g', quantityInBaseUnit: '0.500', defaultOption: true }],
      },
    ]
    const staffList: StaffCatalogItem[] = [
      {
        id: 1,
        nameEn: 'Spinach',
        category: 'Leafy Greens',
        baseUnit: 'BUNCH',
        pricePerUnit: '20.00',
        stock: '10.000',
        available: true,
        options: [],
      },
      {
        id: 2,
        nameEn: 'Brinjal',
        category: 'Everyday Vegetables',
        baseUnit: 'KG',
        pricePerUnit: null,
        stock: '0.000',
        available: false,
        options: [],
      },
    ]

    server.use(
      http.get('*/api/vegetables', () => HttpResponse.json(vegList)),
      http.get('*/api/staff/catalog', () => HttpResponse.json(staffList)),
    )

    wrap(<CatalogPage />)
    await waitFor(() => expect(screen.getByText('Spinach')).toBeInTheDocument())
    expect(screen.getByText('Brinjal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'No price' }))
    expect(screen.queryByText('Spinach')).not.toBeInTheDocument()
    expect(screen.getByText('Brinjal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Available today' }))
    expect(screen.getByText('Spinach')).toBeInTheDocument()
    expect(screen.queryByText('Brinjal')).not.toBeInTheDocument()
  })
})
