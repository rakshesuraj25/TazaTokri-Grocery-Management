import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { useCartStore } from '@/features/cart/store'
import CheckoutPage from '@/features/orders/pages/CheckoutPage'

describe('cart store & idempotency clientRef', () => {
  it('reuses clientRef across cart updates and rotates ONLY on clearCart / resetClientRef', () => {
    const initialRef = useCartStore.getState().clientRef
    expect(initialRef).toMatch(/^[0-9a-f-]{36}$/i)

    useCartStore.getState().addItem({
      vegetableId: '1',
      unitId: '101',
      count: 2,
      nameEn: 'Tomato',
      unitLabel: '500g',
      pricePerUnit: '20.00',
      quantityInBaseUnit: '0.5',
    })

    // Adding or updating items must keep the same clientRef
    expect(useCartStore.getState().clientRef).toBe(initialRef)
    expect(useCartStore.getState().items[0]?.count).toBe(2)

    useCartStore.getState().updateCount('1', '101', 4)
    expect(useCartStore.getState().clientRef).toBe(initialRef)

    // Clearing the cart after a successful order generates a fresh clientRef
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(useCartStore.getState().clientRef).not.toBe(initialRef)
  })

  it('persists and reuses clientRef across a page reload (localStorage rehydration)', async () => {
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem({
      vegetableId: '1',
      unitId: '101',
      count: 8,
      nameEn: 'Tomato',
      unitLabel: '500g',
      pricePerUnit: '20.00',
      quantityInBaseUnit: '0.5',
    })

    const savedRef = useCartStore.getState().clientRef
    const rawPersisted = localStorage.getItem('tazatokri-cart')
    expect(rawPersisted).toBeTruthy()

    // Simulate in-memory state reset on page reload while localStorage remains intact
    useCartStore.setState({ items: [], clientRef: '00000000-0000-0000-0000-000000000000' })
    localStorage.setItem('tazatokri-cart', rawPersisted!)

    await useCartStore.persist.rehydrate()

    expect(useCartStore.getState().clientRef).toBe(savedRef)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0]?.count).toBe(8)
  })

  it('reuses the exact same clientRef after a failed order submit and rotates only on success', async () => {
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem({
      vegetableId: '1',
      unitId: '101',
      count: 8, // 8 * 20 = Rs 160 (>= Rs 150 min order)
      nameEn: 'Tomato',
      unitLabel: '500g',
      pricePerUnit: '20.00',
      quantityInBaseUnit: '0.5',
    })

    const initialClientRef = useCartStore.getState().clientRef
    const capturedClientRefs: string[] = []
    let attempt = 0

    server.use(
      http.get('*/api/customer/addresses', () =>
        HttpResponse.json([
          {
            id: 1,
            label: 'Home',
            line1: 'Flat 101',
            pincode: '411026',
            defaultAddress: true,
          },
        ]),
      ),
      http.post('*/api/customer/orders', async ({ request }) => {
        attempt += 1
        const body = (await request.json()) as { clientRef: string }
        capturedClientRefs.push(body.clientRef)

        if (attempt === 1) {
          return HttpResponse.json(
            { message: 'Temporary stock lock conflict, please retry' },
            { status: 409 },
          )
        }

        return HttpResponse.json(
          {
            id: 501,
            orderNumber: 'ORD-501',
            status: 'PLACED',
            paymentMethod: 'COD',
            paymentStatus: 'PENDING',
            deliveryDate: '2026-04-06',
            deliveryAddress: 'Flat 101, 411026',
            estimatedSubtotal: '160.00',
            finalSubtotal: null,
            deliveryFee: '30.00',
            totalAmount: '190.00',
            expiresAt: null,
            createdAt: new Date().toISOString(),
            items: [],
          },
          { status: 201 },
        )
      }),
    )

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()

    render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/shop/checkout'] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: '/shop/checkout',
              element: React.createElement(CheckoutPage),
            }),
            React.createElement(Route, {
              path: '/shop/orders/:id',
              element: React.createElement('div', { 'data-testid': 'order-detail' }, 'Order Created'),
            }),
          ),
        ),
      ),
    )

    // Wait for address to auto-select so Place Order button is enabled
    const submitBtn = await screen.findByRole('button', { name: /place order/i })
    await waitFor(() => expect(submitBtn).toBeEnabled())

    // 1st submit: fails with 409
    await user.click(submitBtn)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Temporary stock lock conflict, please retry')

    // clientRef must NOT have rotated after failed submit
    expect(useCartStore.getState().clientRef).toBe(initialClientRef)
    expect(capturedClientRefs).toEqual([initialClientRef])

    // 2nd submit (retry): sends the exact same clientRef and succeeds
    await user.click(submitBtn)
    await screen.findByTestId('order-detail')

    expect(capturedClientRefs).toEqual([initialClientRef, initialClientRef])
    // After 201 success, cart is cleared and clientRef is rotated
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(useCartStore.getState().clientRef).not.toBe(initialClientRef)
  })
})
