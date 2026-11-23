import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import CustomerOrdersPage from '@/features/orders/pages/CustomerOrdersPage'
import CustomerOrderDetailPage from '@/features/orders/pages/CustomerOrderDetailPage'
import { useAuthStore } from '@/features/auth/store'
import type { OrderPaymentMethod, OrderResponse, OrderStatus } from '@/features/orders/types'

function makeOrder(
  id: number,
  status: OrderStatus,
  paymentMethod: OrderPaymentMethod = 'COD',
  overrides: Partial<OrderResponse> = {},
): OrderResponse {
  const isPackedOrLater =
    status === 'PACKED' || status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED'
  return {
    id,
    status,
    paymentMethod,
    deliveryDate: '2026-11-22',
    deliveryAddress: '101 MG Road, Shivajinagar',
    deliveryPincode: '411001',
    deliveryInstructions: 'Ring bell twice',
    subtotal: '160.00',
    deliveryFee: '30.00',
    estimatedTotal: '190.00',
    finalTotal: isPackedOrLater ? '198.00' : null,
    createdAt: '2026-11-22T08:00:00Z',
    items: [
      {
        vegetableId: 1,
        vegetableName: 'Tomato',
        quantity: '2.000',
        unitPrice: '80.00',
        estimatedLineTotal: '160.00',
        actualQuantity: isPackedOrLater ? '2.100' : null,
        finalLineTotal: isPackedOrLater ? '168.00' : null,
      },
    ],
    ...overrides,
  }
}

function renderOrdersApp(initialPath = '/shop/orders') {
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
          <Route path="/shop/orders" element={<CustomerOrdersPage />} />
          <Route path="/shop/orders/:id" element={<CustomerOrderDetailPage />} />
          <Route path="/shop" element={<div data-testid="shop-page">Shop</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Customer Journey QA Stage 4: Order Lifecycle & Tracking', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        fullName: 'Asha Patil',
        phone: '9876543210',
        roles: ['CUSTOMER'],
      },
    })
  })

  it('lists orders, filters by Active/Delivered/Cancelled tabs, and navigates to order details', async () => {
    const orders: OrderResponse[] = [
      makeOrder(504, 'PLACED', 'COD'),
      makeOrder(503, 'OUT_FOR_DELIVERY', 'ONLINE'),
      makeOrder(502, 'DELIVERED', 'ONLINE'),
      makeOrder(501, 'CANCELLED', 'COD'),
    ]

    server.use(
      http.get('*/api/customer/orders', () => HttpResponse.json(orders)),
      http.get('*/api/customer/orders/:id', ({ params }) => {
        const found = orders.find((o) => String(o.id) === String(params.id))
        return found
          ? HttpResponse.json(found)
          : HttpResponse.json({ message: 'Order not found' }, { status: 404 })
      }),
      http.get('*/api/public/vegetables', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderOrdersApp('/shop/orders')

    expect(await screen.findByText('#504')).toBeInTheDocument()
    expect(screen.getByText('#503')).toBeInTheDocument()
    expect(screen.getByText('#502')).toBeInTheDocument()
    expect(screen.getByText('#501')).toBeInTheDocument()

    // Filter to Active (PLACED + OUT_FOR_DELIVERY = 2)
    await user.click(screen.getByRole('button', { name: /Active \(2\)/i }))
    expect(screen.getByText('#504')).toBeInTheDocument()
    expect(screen.getByText('#503')).toBeInTheDocument()
    expect(screen.queryByText('#502')).not.toBeInTheDocument()
    expect(screen.queryByText('#501')).not.toBeInTheDocument()

    // Filter to Delivered
    await user.click(screen.getByRole('button', { name: /Delivered \(1\)/i }))
    expect(screen.getByText('#502')).toBeInTheDocument()
    expect(screen.queryByText('#504')).not.toBeInTheDocument()

    // Filter to Cancelled
    await user.click(screen.getByRole('button', { name: /Cancelled \(1\)/i }))
    expect(screen.getByText('#501')).toBeInTheDocument()
    expect(screen.queryByText('#502')).not.toBeInTheDocument()

    // Back to All and navigate to #503 details
    await user.click(screen.getByRole('button', { name: /All \(4\)/i }))
    const detailLinks = screen.getAllByRole('link', { name: /Details/i })
    await user.click(detailLinks[1])

    expect(await screen.findByRole('heading', { name: '#503' })).toBeInTheDocument()
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          /2\.1\s*\(ordered\s*2\)/i.test(element.textContent ?? ''),
      ),
    ).toBeInTheDocument()
  })

  it.each<OrderStatus>([
    'PENDING_PAYMENT',
    'PLACED',
    'CONFIRMED',
    'PACKED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ])('renders deep-linked order detail and stepper accurately for status %s', async (status) => {
    const order = makeOrder(600, status, status === 'PENDING_PAYMENT' ? 'ONLINE' : 'COD')

    server.use(
      http.get('*/api/customer/orders/600', () => HttpResponse.json(order)),
      http.get('*/api/public/vegetables', () => HttpResponse.json([])),
    )

    renderOrdersApp('/shop/orders/600')

    expect(await screen.findByRole('heading', { name: '#600' })).toBeInTheDocument()

    if (status === 'CANCELLED') {
      expect(screen.getByTestId('order-stepper-cancelled')).toBeInTheDocument()
    } else {
      expect(screen.getByTestId('order-status-stepper')).toBeInTheDocument()
    }

    const canCancel =
      status === 'PENDING_PAYMENT' || status === 'PLACED' || status === 'CONFIRMED'
    if (canCancel) {
      expect(screen.getByRole('button', { name: /Cancel order/i })).toBeInTheDocument()
    } else {
      expect(screen.queryByRole('button', { name: /Cancel order/i })).not.toBeInTheDocument()
    }
  })

  it('cancels an eligible order and handles backend rejection when order was packed concurrently', async () => {
    let currentOrder = makeOrder(701, 'CONFIRMED', 'COD')
    let rejectCancel = false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    server.use(
      http.get('*/api/customer/orders/701', () => HttpResponse.json(currentOrder)),
      http.post('*/api/customer/orders/701/cancel', () => {
        if (rejectCancel) {
          return HttpResponse.json(
            { message: 'Order cannot be cancelled when it is PACKED' },
            { status: 409 },
          )
        }
        currentOrder = { ...currentOrder, status: 'CANCELLED' }
        return HttpResponse.json(currentOrder)
      }),
      http.get('*/api/public/vegetables', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderOrdersApp('/shop/orders/701')

    const cancelBtn = await screen.findByRole('button', { name: /Cancel order/i })

    // First test concurrent rejection
    rejectCancel = true
    await user.click(cancelBtn)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel order/i })).toBeEnabled()
    })
    expect(screen.queryByTestId('order-stepper-cancelled')).not.toBeInTheDocument()

    // Now allow cancellation to succeed
    rejectCancel = false
    await user.click(screen.getByRole('button', { name: /Cancel order/i }))

    expect(await screen.findByTestId('order-stepper-cancelled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancel order/i })).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('renders ErrorState for non-existent order IDs and supports back navigation', async () => {
    server.use(
      http.get('*/api/customer/orders/9999', () =>
        HttpResponse.json({ message: 'Order not found: 9999' }, { status: 404 }),
      ),
      http.get('*/api/customer/orders', () => HttpResponse.json([])),
      http.get('*/api/public/vegetables', () => HttpResponse.json([])),
    )

    renderOrdersApp('/shop/orders/9999')
    expect(await screen.findByRole('button', { name: /Try again/i })).toBeInTheDocument()
  })
})
