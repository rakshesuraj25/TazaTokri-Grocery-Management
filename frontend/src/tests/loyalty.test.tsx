import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store'
import { useCartStore } from '@/features/cart/store'
import { storeSettingsApi } from '@/features/settings/api'
import { loyaltyApi } from '@/features/loyalty/api'
import LoyaltyPage from '@/features/loyalty/pages/LoyaltyPage'
import CheckoutPage from '@/features/orders/pages/CheckoutPage'
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

describe('Customer Loyalty & Rewards', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({
      user: {
        userId: 1,
        fullName: 'Anita',
        phone: '9123456789',
        roles: ['CUSTOMER'],
      },
    })
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
      clientRef: 'loyalty-test-ref',
    })
    vi.spyOn(storeSettingsApi, 'getPublic').mockResolvedValue({
      pincodes: ['411026'],
      minOrder: 150,
      deliveryFee: 30,
      freeDeliveryAbove: 300,
      cutoffTime: '18:00',
      storeOpen: true,
    })
  })

  it('displays customer points balance, conversion rate, and transaction history', async () => {
    vi.spyOn(loyaltyApi, 'getMyLoyalty').mockResolvedValue({
      enabled: true,
      balance: 120,
      pointsPer100Inr: 5,
      rupeesPerPoint: 1,
      minRedeemPoints: 50,
      maxRedeemPointsPerOrder: 200,
      expiryDays: null,
      transactions: [
        {
          id: 1,
          orderId: 88,
          type: 'EARN',
          points: 120,
          rupeeValue: 0,
          description: 'Earned from delivered Order #88',
          expiresAt: null,
          createdAt: '2026-11-20T18:00:00',
        },
      ],
    })

    renderWithQuery(<LoyaltyPage />)

    await waitFor(() => expect(screen.getByTestId('loyalty-balance')).toHaveTextContent('120 pts'))
    expect(screen.getByText(/worth ₹120\.00/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /order #88/i })).toBeInTheDocument()
  })

  it('validates insufficient balance and calculates checkout discount & redeemPoints payload', async () => {
    const user = userEvent.setup()
    vi.spyOn(loyaltyApi, 'getMyLoyalty').mockResolvedValue({
      enabled: true,
      balance: 80,
      pointsPer100Inr: 10,
      rupeesPerPoint: 1,
      minRedeemPoints: 20,
      maxRedeemPointsPerOrder: 200,
      expiryDays: null,
      transactions: [],
    })
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      id: 101,
      status: 'PLACED',
      paymentMethod: 'COD',
      items: [],
      subtotal: '200.00',
      deliveryFee: '30.00',
      estimatedTotal: '180.00',
      finalTotal: null,
      deliveryDate: '2026-11-21',
      createdAt: '2026-11-21T12:00:00',
      deliveryAddress: 'Flat 101 — 411026',
    })

    renderWithQuery(<CheckoutPage />)

    const redeemInput = await screen.findByLabelText(/redeem loyalty points/i)
    await user.type(redeemInput, '100')

    expect(screen.getByRole('alert')).toHaveTextContent(/insufficient points balance/i)
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()

    await user.clear(redeemInput)
    await user.type(redeemInput, '50')

    // Subtotal 200 + Fee 30 - Discount 50 = 180.00; earned ~ floor((200 - 50) * 10 / 100) = 15 pts
    expect(screen.getByText(/loyalty discount/i)).toBeInTheDocument()
    expect(screen.getByText(/−₹50\.00/)).toBeInTheDocument()
    expect(screen.getByText(/earn ~15 pts/i)).toBeInTheDocument()

    const placeBtn = screen.getByRole('button', { name: /place order/i })
    expect(placeBtn).toBeEnabled()
    await user.click(placeBtn)

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1))
    expect(postSpy.mock.calls[0]?.[1]).toMatchObject({ redeemPoints: 50 })
  })
})
