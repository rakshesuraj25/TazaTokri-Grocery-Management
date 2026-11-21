import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BusinessReportsPage from '@/features/report/pages/BusinessReportsPage'
import { analyticsApi, type BusinessAnalyticsReport } from '@/features/report/analyticsApi'

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <BusinessReportsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const sampleReport: BusinessAnalyticsReport = {
  from: '2026-11-15',
  to: '2026-11-21',
  totalSales: 2100,
  totalOrders: 9,
  posBills: 6,
  onlineValidOrders: 3,
  averageOrderValue: 233.33,
  totalItemsSold: 21,
  cashCollections: 1200,
  upiDigitalCollections: 700,
  codCollected: 600,
  codSettledToShop: 400,
  codPendingSettlement: 200,
  totalRefunds: 100,
  cashRefunds: 0,
  digitalRefunds: 100,
  cancelledOrders: 1,
  deliveredOrders: 3,
  pendingOrders: 1,
  completedOrders: 3,
  averageDailySales: 300,
  highestSalesDay: {
    date: '2026-11-20',
    totalSales: 1200,
    posSales: 1200,
    onlineSales: 0,
    orderCount: 6,
  },
  dailyTrend: [
    { date: '2026-11-20', totalSales: 1200, posSales: 1200, onlineSales: 0, orderCount: 6 },
    { date: '2026-11-21', totalSales: 900, posSales: 0, onlineSales: 900, orderCount: 3 },
  ],
  paymentBreakdown: [
    { channel: 'POS_CASH', label: 'Shop Cash (POS)', count: 4, amount: 800 },
    { channel: 'POS_UPI', label: 'Shop UPI (POS)', count: 2, amount: 400 },
    { channel: 'COD_CASH', label: 'COD Cash Collected', count: 2, amount: 600 },
    { channel: 'DELIVERY_UPI', label: 'Delivery UPI QR', count: 0, amount: 0 },
    { channel: 'RAZORPAY', label: 'Online (Razorpay)', count: 1, amount: 300 },
  ],
  topProducts: [
    { vegetableId: 1, name: 'Tomato', quantity: 16, revenue: 800 },
    { vegetableId: 2, name: 'Onion', quantity: 5, revenue: 200 },
  ],
  bestSellingProduct: { vegetableId: 1, name: 'Tomato', quantity: 16, revenue: 800 },
  zeroSaleProducts: [{ vegetableId: 3, name: 'Spinach', currentStock: 0 }],
  lowStockCount: 1,
  outOfStockCount: 1,
  totalActiveProducts: 3,
  purchaseSpend: 1500,
}

describe('BusinessReportsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPIs, product analytics, zero-sale products, and purchase spend separately', async () => {
    vi.spyOn(analyticsApi, 'getAnalytics').mockResolvedValue(sampleReport)

    renderPage()

    await waitFor(() => expect(screen.getByText('₹2,100.00')).toBeInTheDocument())
    expect(screen.getByText('Best: Tomato')).toBeInTheDocument()
    expect(screen.getByText('Spinach')).toBeInTheDocument()
    expect(screen.getByText('₹1,500.00')).toBeInTheDocument()
  })

  it('switches date presets and displays empty state when no orders exist', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(analyticsApi, 'getAnalytics').mockResolvedValue({
      ...sampleReport,
      totalSales: 0,
      totalOrders: 0,
      purchaseSpend: 0,
      topProducts: [],
      bestSellingProduct: null,
      highestSalesDay: null,
    })

    renderPage()

    await waitFor(() => expect(screen.getByText(/no sales or orders between/i)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Yesterday' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
  })
})
