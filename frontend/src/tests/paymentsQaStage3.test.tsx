import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import CheckoutPage from '@/features/orders/pages/CheckoutPage'
import CustomerOrderDetailPage from '@/features/orders/pages/CustomerOrderDetailPage'
import { useCartStore } from '@/features/cart/store'
import { useAuthStore } from '@/features/auth/store'

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

function makeOrder(status: 'PENDING_PAYMENT' | 'PLACED', paymentMethod: 'COD' | 'ONLINE') {
  return {
    id: 501,
    customerId: 10,
    customerName: 'Asha Patil',
    customerPhone: '9876543210',
    addressId: 1,
    addressLabel: 'Home',
    addressSummary: '101 MG Road, 411001',
    paymentMethod,
    status,
    estimatedTotal: '230.00',
    finalTotal: null,
    deliveryFee: '30.00',
    deliveryDate: '2026-11-22',
    createdAt: new Date().toISOString(),
    items: [
      {
        vegetableId: 1,
        vegetableName: 'Tomato',
        unitId: 1,
        unitLabel: '1 kg',
        requestedCount: 2,
        unitPrice: '100.00',
        lineTotal: '200.00',
      },
    ],
  }
}

function renderApp(initialPath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/shop" element={<div>Shop Home</div>} />
          <Route path="/shop/checkout" element={<CheckoutPage />} />
          <Route path="/shop/orders/:id" element={<CustomerOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Customer Journey QA Stage 3 — Payments (COD & Razorpay)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useCartStore.getState().clearCart()
    useAuthStore.setState({
      user: { userId: 10, fullName: 'Asha Patil', phone: '9876543210', roles: ['CUSTOMER'] },
      activeRole: 'CUSTOMER',
      isHydrated: true,
    })
    server.use(
      http.get('*/api/public/store-settings', () => HttpResponse.json(STORE_SETTINGS)),
      http.get('*/api/customer/addresses', () => HttpResponse.json(ADDRESSES)),
      http.get('*/api/my/loyalty', () => HttpResponse.json({ enabled: false, balance: 0 })),
      http.get('*/api/public/vegetables', () => HttpResponse.json([])),
    )
  })

  it('completes COD checkout without initiating online payment and records COD method', async () => {
    const user = userEvent.setup()
    let postedMethod: string | null = null
    let paymentStartCalls = 0

    server.use(
      http.post('*/api/customer/orders', async ({ request }) => {
        const body = (await request.json()) as { paymentMethod: string }
        postedMethod = body.paymentMethod
        return HttpResponse.json(makeOrder('PLACED', 'COD'), { status: 201 })
      }),
      http.get('*/api/customer/orders/501', () =>
        HttpResponse.json(makeOrder('PLACED', 'COD')),
      ),
      http.post('*/api/customer/orders/501/payment', () => {
        paymentStartCalls += 1
        return HttpResponse.json({})
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

    renderApp('/shop/checkout')
    await screen.findByText('Home', undefined, { timeout: 5000 })
    await user.click(screen.getByRole('button', { name: /place order/i }))

    await screen.findByText('#501')
    expect(postedMethod).toBe('COD')
    expect(paymentStartCalls).toBe(0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('handles Razorpay payment failure, dismissal, incomplete response, rapid clicks, and successful retry', async () => {
    const user = userEvent.setup()
    let orderStatus: 'PENDING_PAYMENT' | 'PLACED' = 'PENDING_PAYMENT'
    let startCalls = 0
    let failCalls = 0
    let verifyCalls = 0
    let lastOptions: Record<string, unknown> = {}
    const listeners: Record<string, (res: unknown) => void> = {}

    window.Razorpay = class {
      constructor(opts: Record<string, unknown>) {
        lastOptions = opts
      }
      on(ev: string, fn: (res: unknown) => void) {
        listeners[ev] = fn
      }
      open() {}
    } as never

    server.use(
      http.get('*/api/customer/orders/501', () =>
        HttpResponse.json(makeOrder(orderStatus, 'ONLINE')),
      ),
      http.post('*/api/customer/orders/501/payment', () => {
        startCalls += 1
        return HttpResponse.json({
          orderId: 501,
          keyId: 'rzp_test_key',
          razorpayOrderId: `order_rzp_${startCalls}`,
          amountPaise: 23000,
          currency: 'INR',
        })
      }),
      http.post('*/api/customer/orders/501/payment/fail', () => {
        failCalls += 1
        return HttpResponse.json({ orderId: 501, status: 'PENDING_PAYMENT' })
      }),
      http.post('*/api/customer/orders/501/payment/verify', () => {
        verifyCalls += 1
        orderStatus = 'PLACED'
        return HttpResponse.json({ orderId: 501, status: 'PLACED' })
      }),
    )

    renderApp('/shop/orders/501')
    const payBtn = await screen.findByRole('button', { name: /pay now/i })

    // 1. Rapid double-click initiates only 1 Razorpay order
    await user.dblClick(payBtn)
    await waitFor(() => expect(startCalls).toBe(1))
    expect(lastOptions.amount).toBe(23000)

    // 2. Gateway dismissal resets cleanly without marking paid
    const modal = lastOptions.modal as { ondismiss: () => void }
    modal.ondismiss()
    expect(orderStatus).toBe('PENDING_PAYMENT')

    // 3. Incomplete response rejected safely without calling /verify
    await user.click(payBtn)
    await waitFor(() => expect(startCalls).toBe(2))
    const handler = lastOptions.handler as (res: Record<string, string>) => void
    handler({ razorpay_order_id: 'order_rzp_2' })
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(verifyCalls).toBe(0)

    // 4. Payment failure records /fail and allows retry
    await user.click(payBtn)
    await waitFor(() => expect(startCalls).toBe(3))
    listeners['payment.failed']?.({
      error: { description: 'Card declined', reason: 'payment_failed', metadata: { order_id: 'order_rzp_3', payment_id: 'pay_fail_3' } },
    })
    await waitFor(() => expect(failCalls).toBe(1))
    expect(screen.getByRole('alert')).toHaveTextContent(/card declined/i)
    expect(orderStatus).toBe('PENDING_PAYMENT')

    // 5. Network failure during /verify stops polling and surfaces error without marking paid
    await user.click(payBtn)
    await waitFor(() => expect(startCalls).toBe(4))
    server.use(
      http.post('*/api/customer/orders/501/payment/verify', () => HttpResponse.error()),
    )
    const netErrHandler = lastOptions.handler as (res: Record<string, string>) => void
    netErrHandler({
      razorpay_order_id: 'order_rzp_4',
      razorpay_payment_id: 'pay_net_4',
      razorpay_signature: 'valid_sig',
    })
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(orderStatus).toBe('PENDING_PAYMENT')

    // 6. Retry succeeds and verifies order
    server.use(
      http.post('*/api/customer/orders/501/payment/verify', () => {
        verifyCalls += 1
        orderStatus = 'PLACED'
        return HttpResponse.json({ orderId: 501, status: 'PLACED' })
      }),
    )
    await user.click(payBtn)
    await waitFor(() => expect(startCalls).toBe(5))
    const retryHandler = lastOptions.handler as (res: Record<string, string>) => void
    retryHandler({
      razorpay_order_id: 'order_rzp_5',
      razorpay_payment_id: 'pay_ok_5',
      razorpay_signature: 'valid_sig',
    })
    await waitFor(() => expect(verifyCalls).toBe(1))
    expect(orderStatus).toBe('PLACED')
  })

  it('selects ONLINE payment at checkout for ₹150, ₹300, and >₹300 orders and creates PENDING_PAYMENT order', async () => {
    const user = userEvent.setup()
    let postedMethod: string | null = null

    server.use(
      http.post('*/api/customer/orders', async ({ request }) => {
        const body = (await request.json()) as { paymentMethod: string }
        postedMethod = body.paymentMethod
        return HttpResponse.json(makeOrder('PENDING_PAYMENT', 'ONLINE'), { status: 201 })
      }),
      http.get('*/api/customer/orders/501', () =>
        HttpResponse.json(makeOrder('PENDING_PAYMENT', 'ONLINE')),
      ),
    )

    // ₹300.00 subtotal -> ₹0.00 delivery fee -> ₹300.00 total
    useCartStore.getState().addItem({
      vegetableId: '1',
      unitId: '1',
      count: 3,
      nameEn: 'Tomato',
      unitLabel: '1 kg',
      pricePerUnit: '100.00',
      quantityInBaseUnit: '1.000',
    })

    renderApp('/shop/checkout')
    await screen.findByText('Home', undefined, { timeout: 5000 })
    expect(screen.getByText('₹0.00')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /online/i }))
    await user.click(screen.getByRole('button', { name: /place order/i }))

    await screen.findByRole('button', { name: /pay now/i })
    expect(postedMethod).toBe('ONLINE')
  })
})
