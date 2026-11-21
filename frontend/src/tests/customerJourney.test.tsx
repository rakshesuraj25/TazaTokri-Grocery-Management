import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CartContents } from '@/features/cart/components/CartContents'
import CheckoutPage from '@/features/orders/pages/CheckoutPage'
import { useCartStore } from '@/features/cart/store'
import { storeSettingsApi } from '@/features/settings/api'
import {
  estimateDeliveryFee,
  isMinimumOrderMet,
  isSameDayDeliveryIST,
} from '@/lib/businessRules'
import { api } from '@/lib/api'

vi.mock('@/features/users/hooks', () => ({
  useCustomerAddresses: () => ({
    data: [
      {
        id: 501,
        label: 'Home',
        line1: 'Flat 101',
        pincode: '411026',
        defaultAddress: true,
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useCreateAddress: () => ({ mutate: vi.fn(), isPending: false }),
}))

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('Customer Journey — Store Settings & Checkout Validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useCartStore.setState({
      items: [
        {
          vegetableId: '20',
          unitId: '201',
          count: 4,
          nameEn: 'Tomato',
          unitLabel: '1 kg',
          pricePerUnit: '50.00',
          quantityInBaseUnit: '1',
        },
      ],
      combos: [],
      clientRef: 'test-client-ref',
    })
  })

  it('evaluates dynamic minOrder, deliveryFee, freeDeliveryAbove, and HH:mm IST cutoff', () => {
    const customRules = {
      minOrder: 200,
      deliveryFee: 40,
      freeDeliveryAbove: 400,
      cutoffTime: '18:30',
      storeOpen: true,
    }

    expect(isMinimumOrderMet(199, customRules)).toBe(false)
    expect(isMinimumOrderMet(200, customRules)).toBe(true)
    expect(estimateDeliveryFee(200, customRules).toNumber()).toBe(40)
    expect(estimateDeliveryFee(400, customRules).toNumber()).toBe(0)

    expect(isSameDayDeliveryIST(new Date('2026-11-21T18:29:00+05:30'), '18:30')).toBe(true)
    expect(isSameDayDeliveryIST(new Date('2026-11-21T18:30:00+05:30'), '18:30')).toBe(false)
  })

  it('disables checkout in CartContents when store is paused and respects dynamic rules', () => {
    const onCheckout = vi.fn()
    renderWithQuery(
      <CartContents
        onCheckout={onCheckout}
        rules={{
          minOrder: 150,
          deliveryFee: 30,
          freeDeliveryAbove: 300,
          cutoffTime: '18:00',
          storeOpen: false,
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/paused/i)
    expect(screen.getByRole('button', { name: /proceed to checkout/i })).toBeDisabled()
  })

  it('blocks Place Order in CheckoutPage when store is paused', async () => {
    vi.spyOn(storeSettingsApi, 'getPublic').mockResolvedValue({
      pincodes: ['411026'],
      minOrder: 150,
      deliveryFee: 30,
      freeDeliveryAbove: 300,
      cutoffTime: '18:00',
      storeOpen: false,
    })

    renderWithQuery(<CheckoutPage />)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/paused for new online orders/i),
    )
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()
  })

  it('flags unserviceable PIN code in CheckoutPage and disables Place Order', async () => {
    vi.spyOn(storeSettingsApi, 'getPublic').mockResolvedValue({
      pincodes: ['411039'],
      minOrder: 150,
      deliveryFee: 30,
      freeDeliveryAbove: 300,
      cutoffTime: '18:00',
      storeOpen: true,
    })

    renderWithQuery(<CheckoutPage />)

    await waitFor(() => expect(screen.getByText(/not serviceable/i)).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/411026/i)
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()
  })

  it('allows COD Place Order when store is open, PIN is serviceable, and minimum order is met', async () => {
    vi.spyOn(storeSettingsApi, 'getPublic').mockResolvedValue({
      pincodes: ['411026'],
      minOrder: 150,
      deliveryFee: 30,
      freeDeliveryAbove: 300,
      cutoffTime: '18:00',
      storeOpen: true,
    })
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      id: 99,
      status: 'PLACED',
      paymentMethod: 'COD',
      items: [],
      subtotal: '200.00',
      deliveryFee: '30.00',
      estimatedTotal: '230.00',
      finalTotal: null,
      deliveryDate: '2026-11-21',
      createdAt: '2026-11-21T10:00:00',
      deliveryAddress: 'Flat 101 — 411026',
    })

    renderWithQuery(<CheckoutPage />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /place order/i })).toBeEnabled(),
    )
    screen.getByRole('button', { name: /place order/i }).click()

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1))
  })
})
