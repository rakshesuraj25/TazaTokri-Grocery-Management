import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import CheckoutPage from '@/features/orders/pages/CheckoutPage'
import { useCartStore } from '@/features/cart/store'
import { useAuthStore } from '@/features/auth/store'
import type { CustomerAddress } from '@/features/users/types'

const STORE_SETTINGS = {
  storeOpen: true,
  cutoffTime: '18:00',
  minOrder: 150,
  deliveryFee: 30,
  freeDeliveryAbove: 300,
  pincodes: ['411001', '411002'],
}

const SAVED_ADDRESSES: CustomerAddress[] = [
  {
    id: 1,
    label: 'Old Home',
    line1: '101 MG Road',
    line2: null,
    landmark: 'Near Post Office',
    pincode: '411099', // unserviceable
    deliveryInstructions: null,
    defaultAddress: true,
  },
  {
    id: 2,
    label: 'Office',
    line1: '22 FC Road',
    line2: null,
    landmark: null,
    pincode: '411001', // serviceable
    deliveryInstructions: null,
    defaultAddress: false,
  },
]

function renderCheckout() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/shop/checkout']}>
        <Routes>
          <Route path="/shop" element={<div>Shop Home</div>} />
          <Route path="/shop/checkout" element={<CheckoutPage />} />
          <Route path="/shop/orders/:id" element={<div>Order Placed Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Customer Journey QA Stage 2 — Checkout & Address', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    useAuthStore.setState({
      user: { userId: 10, fullName: 'Asha Patil', phone: '9876543210', roles: ['CUSTOMER'] },
      activeRole: 'CUSTOMER',
      isHydrated: true,
    })
    server.use(
      http.get('http://localhost:8080/api/public/store-settings', () => HttpResponse.json(STORE_SETTINGS)),
      http.get('http://localhost:8080/api/customer/addresses', () => HttpResponse.json(SAVED_ADDRESSES)),
      http.get('http://localhost:8080/api/my/loyalty', () => HttpResponse.json({ enabled: false, balance: 0 })),
    )
  })

  it('shows empty-cart state when navigating to checkout with an empty cart', () => {
    renderCheckout()
    expect(screen.getByText(/empty/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /shop/i })).toHaveAttribute('href', '/shop')
  })

  it('blocks order below ₹150, calculates ₹30 fee below ₹300 and ₹0 fee at/above ₹300, and preserves cart on back', async () => {
    const user = userEvent.setup()

    // 1. Below ₹150 (₹100 subtotal) -> Place Order disabled
    useCartStore.getState().addItem({
      vegetableId: '1',
      unitId: '1',
      count: 1,
      nameEn: 'Tomato',
      unitLabel: '1 kg',
      pricePerUnit: '100.00',
      quantityInBaseUnit: '1.000',
    })
    const { unmount } = renderCheckout()
    await screen.findByText('Office')
    await user.click(screen.getByRole('radio', { name: /office/i }))
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()
    unmount()

    // 2. ₹200 subtotal (>= ₹150, < ₹300) -> ₹30 fee, ₹230 total
    useCartStore.getState().updateCount('1', '1', 2)
    const { unmount: unmountMid } = renderCheckout()
    await screen.findByText('Office')
    await user.click(screen.getByRole('radio', { name: /office/i }))
    expect(screen.getAllByText('₹200.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('₹30.00')).toBeInTheDocument()
    expect(screen.getByText('₹230.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /place order/i })).toBeEnabled()
    unmountMid()

    // 3. ₹300 subtotal (>= ₹300) -> ₹0.00 fee, ₹300.00 total
    useCartStore.getState().updateCount('1', '1', 3)
    renderCheckout()
    await screen.findByText('Office')
    await user.click(screen.getByRole('radio', { name: /office/i }))
    expect(screen.getAllByText('₹300.00').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('₹0.00')).toBeInTheDocument()

    // Back navigation preserves cart
    await user.click(screen.getByRole('link', { name: /back/i }))
    expect(await screen.findByText('Shop Home')).toBeInTheDocument()
    expect(useCartStore.getState().items[0]?.count).toBe(3)
  })

  it('validates address entry, blocks unserviceable PINs, auto-selects newly added address, handles settings failure, and prevents duplicate submit', async () => {
    const user = userEvent.setup()
    let orderPosts = 0
    const addrList = [...SAVED_ADDRESSES]

    server.use(
      http.get('http://localhost:8080/api/customer/addresses', () => HttpResponse.json(addrList)),
      http.post('http://localhost:8080/api/customer/addresses', async ({ request }) => {
        const body = (await request.json()) as Record<string, string>
        const created = {
          id: 99,
          label: body.label,
          line1: body.line1,
          line2: body.line2 ?? null,
          landmark: body.landmark ?? null,
          pincode: body.pincode,
          deliveryInstructions: body.deliveryInstructions ?? null,
          defaultAddress: false,
        }
        addrList.push(created)
        return HttpResponse.json(created, { status: 201 })
      }),
      http.post('http://localhost:8080/api/customer/orders', async () => {
        orderPosts += 1
        await new Promise((r) => setTimeout(r, 80))
        return HttpResponse.json({ id: 501, status: 'PLACED' }, { status: 201 })
      }),
    )

    useCartStore.getState().addItem({
      vegetableId: '1',
      unitId: '1',
      count: 2,
      nameEn: 'Tomato',
      unitLabel: '1 kg',
      pricePerUnit: '100.00',
      quantityInBaseUnit: '1.000',
    })

    renderCheckout()

    // Default Old Home (411099) is unserviceable -> alert shown and Place Order disabled
    await screen.findByText('Old Home')
    expect(screen.getByRole('alert')).toHaveTextContent('411099')
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()

    // Open Add Address dialog and test whitespace/invalid PIN validation
    await user.click(screen.getByRole('button', { name: /add address/i }))
    await user.type(screen.getByLabelText(/address line 1/i), '   ')
    await user.type(screen.getByLabelText(/pin\s*code|pincode/i), '4110')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText(/required/i)).toBeInTheDocument()

    // Enter valid fields but unserviceable PIN -> blocked with clear message
    await user.clear(screen.getByLabelText(/address line 1/i))
    await user.type(screen.getByLabelText(/address line 1/i), '12 Baner Road')
    await user.clear(screen.getByLabelText(/pin\s*code|pincode/i))
    await user.type(screen.getByLabelText(/pin\s*code|pincode/i), '411045')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText(/411045/)).toBeInTheDocument()

    // Fix PIN to serviceable 411002 -> saved & auto-selected -> Place Order enabled
    await user.clear(screen.getByLabelText(/pin\s*code|pincode/i))
    await user.type(screen.getByLabelText(/pin\s*code|pincode/i), '411002')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /place order/i })).toBeEnabled())

    // Rapid double-click submits only once
    const placeBtn = screen.getByRole('button', { name: /place order/i })
    await user.dblClick(placeBtn)
    await screen.findByText('Order Placed Page')
    expect(orderPosts).toBe(1)
  })

  it('falls back safely when store-settings API fails', async () => {
    server.use(
      http.get('http://localhost:8080/api/public/store-settings', () => HttpResponse.error()),
    )
    useCartStore.getState().addItem({
      vegetableId: '1',
      unitId: '1',
      count: 2,
      nameEn: 'Tomato',
      unitLabel: '1 kg',
      pricePerUnit: '100.00',
      quantityInBaseUnit: '1.000',
    })
    renderCheckout()
    await screen.findByText('Old Home')
    expect(screen.getByText('₹230.00')).toBeInTheDocument()
  })
})
