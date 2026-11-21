import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store'
import { useCartStore } from '@/features/cart/store'
import { storeSettingsApi } from '@/features/settings/api'
import { loyaltyApi } from '@/features/loyalty/api'
import { retentionApi } from '@/features/retention/api'
import RetentionMarketingPage from '@/features/retention/pages/RetentionMarketingPage'
import CheckoutPage from '@/features/orders/pages/CheckoutPage'

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

describe('Customer Retention & Promotional Offers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({
      user: {
        userId: 1,
        fullName: 'Store Owner',
        phone: '9999999999',
        roles: ['OWNER'],
      },
    })
  })

  it('renders retention KPIs, filters by segment, and creates a promo offer', async () => {
    const user = userEvent.setup()
    const insightsSpy = vi.spyOn(retentionApi, 'getInsights').mockResolvedValue({
      from: '2026-10-23',
      to: '2026-11-21',
      inactiveDaysThreshold: 30,
      highValueThreshold: 2000,
      totalCustomers: 4,
      newCustomersInPeriod: 1,
      repeatCustomers: 3,
      repeatPurchaseRate: 75,
      inactiveCustomers: 1,
      highValueCustomers: 1,
      averageOrderFrequency: 2.5,
      averageLifetimeSpend: 1237.5,
      totalMatchingCustomers: 1,
      page: 0,
      size: 15,
      customers: [
        {
          customerId: 3,
          fullName: 'Chitra',
          phone: '9000000003',
          totalOrders: 4,
          totalSpend: 3200,
          averageOrderValue: 800,
          lastOrderDate: '2026-11-20',
          daysSinceLastOrder: 1,
          loyaltyBalance: 120,
          segment: 'HIGH_VALUE',
        },
      ],
    })
    vi.spyOn(retentionApi, 'listPromos').mockResolvedValue([])
    const createSpy = vi.spyOn(retentionApi, 'createPromo').mockResolvedValue({
      id: 1,
      name: 'Fresh 20',
      code: 'FRESH20',
      description: '20% off',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderAmount: 150,
      maxDiscountAmount: 50,
      startsAt: '2026-11-21T00:00:00',
      expiresAt: '2026-12-05T23:59:00',
      maxTotalUses: null,
      maxUsesPerCustomer: 1,
      enabled: true,
      totalUsed: 0,
    })

    renderWithQuery(<RetentionMarketingPage />)

    await waitFor(() => expect(screen.getByText('Chitra')).toBeInTheDocument())
    expect(screen.getByText('3 (75%)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'INACTIVE' }))
    await waitFor(() => expect(insightsSpy).toHaveBeenCalledTimes(2))

    await user.click(screen.getByRole('button', { name: /new promo offer/i }))
    await user.type(screen.getByLabelText(/offer name/i), 'Fresh 20')
    await user.type(screen.getByLabelText(/promo code/i), 'FRESH20')
    await user.click(screen.getByRole('button', { name: /save offer/i }))

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
  })

  it('applies valid promo code and shows error for invalid/expired codes in CheckoutPage', async () => {
    const user = userEvent.setup()
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
      clientRef: 'promo-checkout-ref',
    })
    vi.spyOn(storeSettingsApi, 'getPublic').mockResolvedValue({
      pincodes: ['411026'],
      minOrder: 150,
      deliveryFee: 30,
      freeDeliveryAbove: 300,
      cutoffTime: '18:00',
      storeOpen: true,
    })
    vi.spyOn(loyaltyApi, 'getMyLoyalty').mockResolvedValue({
      enabled: false,
      balance: 0,
      pointsPer100Inr: 5,
      rupeesPerPoint: 1,
      minRedeemPoints: 50,
      maxRedeemPointsPerOrder: 200,
      expiryDays: null,
      transactions: [],
    })
    const validateSpy = vi
      .spyOn(retentionApi, 'validatePromo')
      .mockRejectedValueOnce(new Error('Promo code has expired'))
      .mockResolvedValueOnce({
        code: 'FRESH20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        discountAmount: 40,
        description: '20% off',
      })

    renderWithQuery(<CheckoutPage />)

    const promoInput = await screen.findByLabelText(/promo code/i)
    await user.type(promoInput, 'OLD10')
    await user.click(screen.getByRole('button', { name: /^apply$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/expired/i))

    await user.clear(promoInput)
    await user.type(promoInput, 'FRESH20')
    await user.click(screen.getByRole('button', { name: /^apply$/i }))

    await waitFor(() => expect(validateSpy).toHaveBeenCalledTimes(2))
    expect(screen.getByText(/code fresh20 applied/i)).toBeInTheDocument()
    expect(screen.getAllByText(/−₹40\.00/).length).toBeGreaterThanOrEqual(2)
  })
})
