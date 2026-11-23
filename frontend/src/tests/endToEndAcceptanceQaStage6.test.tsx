import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import ShopPage from '@/features/catalog/pages/ShopPage'
import CheckoutPage from '@/features/orders/pages/CheckoutPage'
import CustomerOrderDetailPage from '@/features/orders/pages/CustomerOrderDetailPage'
import { useCartStore } from '@/features/cart/store'
import { useAuthStore } from '@/features/auth/store'

const VEGETABLES = [
  {
    id: 1,
    nameEn: 'Tomato',
    nameMr: 'टोमॅटो',
    nameHi: 'टमाटर',
    category: 'Daily Essentials',
    baseUnit: 'KG',
    pricePerUnit: '80.00',
    inStock: true,
    availableStock: '25.000',
    imageUrl: '/vegetables/tomato.jpg',
    options: [
      { unitId: 11, label: '1 kg', quantityInBaseUnit: '1.000', price: '80.00', defaultOption: true },
    ],
  },
]

const STORE_SETTINGS = {
  storeOpen: true,
  cutoffTime: '18:00',
  minOrder: 150,
  deliveryFee: 30,
  freeDeliveryAbove: 300,
  pincodes: ['411001'],
}

const ADDRESSES = [
  {
    id: 1,
    label: 'Home',
    line1: '101 MG Road',
    line2: null,
    landmark: null,
    pincode: '411001',
    deliveryInstructions: null,
    defaultAddress: true,
  },
]

function renderE2EApp(initialPath = '/shop') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/checkout" element={<CheckoutPage />} />
          <Route path="/shop/orders/:id" element={<CustomerOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Stage 6 End-to-End Acceptance QA (Frontend Journey)', () => {
  beforeEach(() => {
    localStorage.clear()
    useCartStore.setState({ items: [], combos: [] })
    useAuthStore.setState({
      user: {
        userId: 10,
        fullName: 'Asha Patil',
        phone: '9876543210',
        roles: ['CUSTOMER'],
      },
      activeRole: 'CUSTOMER',
      isHydrated: true,
    })
  })

  it('completes integrated Shop -> Cart -> Checkout (COD) -> Order Detail Tracking flow', async () => {
    const placedOrder = {
      id: 901,
      status: 'PLACED',
      paymentMethod: 'COD',
      deliveryDate: '2026-11-22',
      deliveryAddress: '101 MG Road',
      deliveryPincode: '411001',
      deliveryInstructions: null,
      subtotal: '160.00',
      deliveryFee: '30.00',
      estimatedTotal: '190.00',
      finalTotal: null,
      createdAt: '2026-11-22T10:00:00Z',
      items: [
        {
          vegetableId: 1,
          vegetableName: 'Tomato',
          quantity: '2.000',
          unitPrice: '80.00',
          estimatedLineTotal: '160.00',
          actualQuantity: null,
          finalLineTotal: null,
        },
      ],
    }

    server.use(
      http.get('*/api/public/vegetables', () => HttpResponse.json(VEGETABLES)),
      http.get('*/api/public/combos', () => HttpResponse.json([])),
      http.get('*/api/public/categories', () =>
        HttpResponse.json([{ id: 10, name: 'Daily Essentials', active: true }]),
      ),
      http.get('*/api/public/store-settings', () => HttpResponse.json(STORE_SETTINGS)),
      http.get('*/api/customer/addresses', () => HttpResponse.json(ADDRESSES)),
      http.get('*/api/customer/loyalty', () =>
        HttpResponse.json({ pointsBalance: 0, totalEarned: 0, totalRedeemed: 0 }),
      ),
      http.get('*/api/my/baskets', () => HttpResponse.json([])),
      http.get('*/api/customer/orders', () => HttpResponse.json([])),
      http.post('*/api/customer/orders', () => HttpResponse.json(placedOrder, { status: 201 })),
      http.get('*/api/customer/orders/901', () => HttpResponse.json(placedOrder)),
    )

    const user = userEvent.setup()
    renderE2EApp('/shop')

    // 1. Browse & Add to Cart (2 x 1 kg Tomato = ₹160, above ₹150 min order)
    const addButtons = await screen.findAllByRole('button', { name: /Add/i })
    await user.click(addButtons[0])

    const incBtn = await screen.findByRole('button', { name: /Increase/i })
    await user.click(incBtn)

    await waitFor(() => {
      expect(useCartStore.getState().items[0]?.count).toBe(2)
    })

    // 2. Navigate to Checkout (simulating checkout route transition with populated cart)
    renderE2EApp('/shop/checkout')
    expect(await screen.findByText(/101 MG Road/i)).toBeInTheDocument()

    // 3. Place COD order
    const placeBtn = await screen.findByRole('button', { name: /Place order/i })
    await user.click(placeBtn)

    // 4. Verify navigation to Order Detail #901, cart cleared, and stepper rendered
    expect(await screen.findByRole('heading', { name: '#901' })).toBeInTheDocument()
    expect(screen.getByTestId('order-status-stepper')).toBeInTheDocument()
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})
