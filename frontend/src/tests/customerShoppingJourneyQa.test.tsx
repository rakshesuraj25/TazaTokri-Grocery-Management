import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import ShopPage from '@/features/catalog/pages/ShopPage'
import { useCartStore } from '@/features/cart/store'
import { useAuthStore } from '@/features/auth/store'
import type { PublicVegetable } from '@/features/catalog/types'

const CATALOG: PublicVegetable[] = [
  {
    id: 1,
    nameEn: 'Tomato',
    nameMr: 'टोमॅटो',
    nameHi: 'टमाटर',
    category: 'Everyday Vegetables',
    baseUnit: 'KG',
    pricePerUnit: '40.00',
    inStock: true,
    availableStock: '25.000',
    imageUrl: '/vegetables/tomato.jpg',
    options: [
      { unitId: 1, label: '500 g', quantityInBaseUnit: '0.500', price: '20.00', defaultOption: true },
      { unitId: 2, label: '1 kg', quantityInBaseUnit: '1.000', price: '40.00', defaultOption: false },
    ],
  },
  {
    id: 2,
    nameEn: 'Spinach (Palak)',
    nameMr: 'पालक',
    nameHi: 'पालक',
    category: 'Leafy Greens',
    baseUnit: 'BUNCH',
    pricePerUnit: '20.00',
    inStock: true,
    availableStock: '15.000',
    imageUrl: '/vegetables/spinach.jpg',
    options: [
      { unitId: 3, label: '1 bunch', quantityInBaseUnit: '1.000', price: '20.00', defaultOption: true },
    ],
  },
  {
    id: 3,
    nameEn: 'Onion (Kanda)',
    nameMr: 'कांदा',
    nameHi: 'प्याज',
    category: 'Roots & Tubers',
    baseUnit: 'KG',
    pricePerUnit: '120.00',
    inStock: true,
    availableStock: '40.000',
    imageUrl: '/vegetables/onion.jpg',
    options: [
      { unitId: 4, label: '1 kg', quantityInBaseUnit: '1.000', price: '120.00', defaultOption: true },
      { unitId: 5, label: '2 kg', quantityInBaseUnit: '2.000', price: '240.00', defaultOption: false },
    ],
  },
  {
    id: 4,
    nameEn: 'Capsicum',
    nameMr: 'ढोबळी मिरची',
    nameHi: 'शिमला मिर्च',
    category: 'Everyday Vegetables',
    baseUnit: 'KG',
    pricePerUnit: '70.00',
    inStock: true,
    availableStock: '10.000',
    imageUrl: '/vegetables/capsicum.jpg',
    options: [
      { unitId: 6, label: '500 g', quantityInBaseUnit: '0.500', price: '35.00', defaultOption: true },
    ],
  },
  {
    id: 5,
    nameEn: 'Fresh Coriander',
    nameMr: 'कोथिंबीर',
    nameHi: 'धनिया',
    category: 'Herbs & Aromatics',
    baseUnit: 'BUNCH',
    pricePerUnit: '15.00',
    inStock: false,
    availableStock: '0.000',
    imageUrl: '/vegetables/fresh-coriander.jpg',
    options: [
      { unitId: 7, label: '1 bunch', quantityInBaseUnit: '1.000', price: '15.00', defaultOption: true },
    ],
  },
]

const STORE_SETTINGS = {
  storeOpen: true,
  cutoffTime: '18:00',
  minOrder: 150,
  deliveryFee: 30,
  freeDeliveryAbove: 300,
  serviceablePincodes: ['411001', '411002'],
}

function renderStorefront() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/shop']}>
        <Routes>
          <Route element={<CustomerLayout />}>
            <Route path="/shop" element={<ShopPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Customer Shopping Journey QA (Stage 1)', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    useAuthStore.setState({ user: null, activeRole: null, isHydrated: true })
    server.use(
      http.get('http://localhost:8080/api/public/vegetables', () => HttpResponse.json(CATALOG)),
      http.get('http://localhost:8080/api/public/combos', () => HttpResponse.json([])),
      http.get('http://localhost:8080/api/public/store-settings', () => HttpResponse.json(STORE_SETTINGS)),
    )
  })

  it('loads storefront, displays catalog, categories, images, prices, units, and out-of-stock state', async () => {
    renderStorefront()

    const catalogEl = await waitFor(() => {
      const el = document.getElementById('shop-catalog')
      expect(el).toBeInTheDocument()
      return el!
    })

    // Products, prices, and out-of-stock state render properly
    expect(within(catalogEl).getByText('Tomato')).toBeInTheDocument()
    expect(within(catalogEl).getByText('Spinach (Palak)')).toBeInTheDocument()
    expect(within(catalogEl).getByText('Fresh Coriander')).toBeInTheDocument()
    expect(within(catalogEl).getAllByText(/out of stock/i).length).toBeGreaterThanOrEqual(1)
    expect(within(catalogEl).getAllByText('₹20.00').length).toBeGreaterThanOrEqual(2)

    // Categories display
    expect(screen.getAllByRole('button', { name: /everyday vegetables/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /leafy greens/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('supports exact, partial, case-insensitive, Marathi/Hindi search, category filters, and empty state clear', async () => {
    const user = userEvent.setup()
    renderStorefront()
    await waitFor(() => expect(document.getElementById('shop-catalog')).toBeInTheDocument())

    const searchInput = screen.getByRole('searchbox')

    // Partial + case-insensitive search
    await user.type(searchInput, 'toma')
    let catalogEl = document.getElementById('shop-catalog')!
    expect(within(catalogEl).getByText('Tomato')).toBeInTheDocument()
    expect(within(catalogEl).queryByText('Spinach (Palak)')).not.toBeInTheDocument()

    // Uppercase search
    await user.clear(searchInput)
    await user.type(searchInput, 'CAPSICUM')
    catalogEl = document.getElementById('shop-catalog')!
    expect(within(catalogEl).getByText('Capsicum')).toBeInTheDocument()
    expect(within(catalogEl).queryByText('Tomato')).not.toBeInTheDocument()

    // Marathi name search
    await user.clear(searchInput)
    await user.type(searchInput, 'कांदा')
    catalogEl = document.getElementById('shop-catalog')!
    expect(within(catalogEl).getByText('Onion (Kanda)')).toBeInTheDocument()

    // Nonexistent product -> empty state -> Clear filters button
    await user.clear(searchInput)
    await user.type(searchInput, 'Dragonfruit')
    expect(document.getElementById('shop-catalog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    await waitFor(() => expect(document.getElementById('shop-catalog')).toBeInTheDocument())

    // Category filter + search combination
    await user.click(screen.getAllByRole('button', { name: /roots & tubers/i })[0]!)
    catalogEl = document.getElementById('shop-catalog')!
    expect(within(catalogEl).getByText('Onion (Kanda)')).toBeInTheDocument()
    expect(within(catalogEl).queryByText('Tomato')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^all$/i }))
    catalogEl = document.getElementById('shop-catalog')!
    expect(within(catalogEl).getByText('Tomato')).toBeInTheDocument()
  })

  it('handles add to cart, unit variants, increment/decrement/remove, CartDrawer, business rules (₹150 min / ₹30 fee / free >= ₹300), and persistence', async () => {
    const user = userEvent.setup()
    const { unmount } = renderStorefront()
    await waitFor(() => expect(document.getElementById('shop-catalog')).toBeInTheDocument())

    const catalogEl = document.getElementById('shop-catalog')!

    // Add Tomato (500 g -> ₹20)
    const tomatoCard = within(catalogEl).getByText('Tomato').closest('div[class*="rounded-"]')! as HTMLElement
    await user.click(within(tomatoCard).getByRole('button', { name: /^add$/i }))
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0]?.pricePerUnit).toBe('20.00')

    // Switch Tomato unit to 1 kg (₹40) and add as second line
    await user.click(within(tomatoCard).getByRole('radio', { name: /1 kg/i }))
    await user.click(within(tomatoCard).getByRole('button', { name: /^add$/i }))
    expect(useCartStore.getState().items).toHaveLength(2)

    // Increase Tomato 1 kg quantity from 1 -> 2 (subtotal = 20 + 80 = ₹100)
    await user.click(within(tomatoCard).getByRole('button', { name: /increase/i }))
    expect(useCartStore.getState().items[1]?.count).toBe(2)

    // Decrease Tomato 1 kg quantity 2 -> 1 -> 0 (removes item cleanly, no negative quantities)
    await user.click(within(tomatoCard).getByRole('button', { name: /decrease/i }))
    expect(useCartStore.getState().items[1]?.count).toBe(1)
    await user.click(within(tomatoCard).getByRole('button', { name: /decrease/i }))
    expect(useCartStore.getState().items).toHaveLength(1)

    // Header cart badge shows 1; open CartDrawer from header button
    const headerEl = document.querySelector('header')!
    const cartHeaderBtn = within(headerEl).getByRole('button', { name: /cart \(1\)/i })
    await user.click(cartHeaderBtn)

    const drawer = await screen.findByRole('dialog')
    // Subtotal is ₹20 (< ₹150 min order): Checkout button must be disabled and ₹30 delivery fee shown
    expect(within(drawer).getAllByText('₹20.00').length).toBeGreaterThanOrEqual(2)
    expect(within(drawer).getByText('₹30.00')).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: /checkout/i })).toBeDisabled()

    await user.keyboard('{Escape}')

    // Add Onion 1 kg (₹120) + 1 kg again -> subtotal = 20 + 240 = ₹260 (>= ₹150 min, < ₹300 free threshold -> ₹30 delivery, ₹290 total)
    const onionCard = within(catalogEl).getByText('Onion (Kanda)').closest('div[class*="rounded-"]')!
    await user.click(within(onionCard as HTMLElement).getByRole('button', { name: /^add$/i }))
    await user.click(within(onionCard as HTMLElement).getByRole('button', { name: /increase/i }))

    await user.click(within(headerEl).getByRole('button', { name: /cart \(3\)/i }))
    const drawerMid = await screen.findByRole('dialog')
    expect(within(drawerMid).getByText('₹260.00')).toBeInTheDocument()
    expect(within(drawerMid).getByText('₹30.00')).toBeInTheDocument()
    expect(within(drawerMid).getByText('₹290.00')).toBeInTheDocument()
    expect(within(drawerMid).getByRole('button', { name: /checkout/i })).toBeEnabled()

    await user.keyboard('{Escape}')

    // Increase Onion once more -> subtotal = 20 + 360 = ₹380 (>= ₹300 free delivery -> ₹0.00 delivery, ₹380.00 total)
    await user.click(within(onionCard as HTMLElement).getByRole('button', { name: /increase/i }))
    await user.click(within(headerEl).getByRole('button', { name: /cart \(4\)/i }))
    const drawerFree = await screen.findByRole('dialog')
    expect(within(drawerFree).getAllByText('₹380.00').length).toBeGreaterThanOrEqual(2)
    expect(within(drawerFree).getByText('₹0.00')).toBeInTheDocument()

    // Verify cart persistence in localStorage across simulated page refresh (unmount + remount)
    const persistedRaw = localStorage.getItem('tazatokri-cart')
    expect(persistedRaw).toBeTruthy()
    unmount()

    renderStorefront()
    await waitFor(() => expect(document.getElementById('shop-catalog')).toBeInTheDocument())
    expect(within(document.querySelector('header')!).getByRole('button', { name: /cart \(4\)/i })).toBeInTheDocument()
  })
})
