import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { reportOverviewApi, type BusinessOverviewResponse } from '@/features/report/overviewApi'
import DashboardPage from '@/features/report/pages/DashboardPage'

function renderDashboard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Business Overview Dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPIs, order status, financials, inventory alerts, top products, quick actions, and recent activity', async () => {
    const payload: BusinessOverviewResponse = {
      kpis: {
        date: '2026-11-21',
        todaySales: '4500.00',
        yesterdaySales: '3000.00',
        salesChangeAmount: '1500.00',
        salesChangePercent: '50.0',
        todayOrders: 15,
        pendingOrders: 3,
        completedOrders: 11,
        cancelledOrders: 1,
        averageOrderValue: '300.00',
      },
      orderStatus: {
        pendingConfirmation: 2,
        confirmed: 1,
        preparing: 0,
        outForDelivery: 1,
        delivered: 10,
        cancelled: 1,
      },
      inventoryAlerts: [
        {
          vegetableId: 1,
          name: 'Tomato',
          unit: 'KG',
          currentStock: '0.000',
          alertType: 'OUT_OF_STOCK',
          daysRemaining: '0.0',
          suggestedPurchaseQty: '14.000',
        },
      ],
      topSellingToday: [
        {
          vegetableId: 2,
          name: 'Onion',
          unit: 'KG',
          quantitySold: '25.000',
          revenue: '1000.00',
        },
      ],
      financials: {
        todayCashSales: '2000.00',
        todayDigitalSales: '1500.00',
        codCollected: '1000.00',
        codSettledToShop: '700.00',
        codPendingSettlement: '300.00',
        supplierOutstandingPayable: '1250.00',
      },
      recentActivity: [
        {
          type: 'ORDER',
          title: 'Order #105',
          subtitle: 'DELIVERED',
          amount: '420.00',
          timestamp: '2026-11-21T10:15:00',
          link: '/staff/orders/105',
        },
      ],
    }

    vi.spyOn(reportOverviewApi, 'getOverview').mockResolvedValue(payload)

    renderDashboard()

    expect(await screen.findByText('₹4,500.00')).toBeInTheDocument()
    expect(screen.getByText(/\+50\.0% vs yesterday/i)).toBeInTheDocument()
    expect(screen.getAllByText('₹300.00').length).toBeGreaterThanOrEqual(2)

    // Order overview & Financials
    expect(screen.getByText('Pending Confirmation')).toBeInTheDocument()
    expect(screen.getByText('₹700.00')).toBeInTheDocument()
    expect(screen.getByText('₹1,250.00')).toBeInTheDocument()

    // Inventory alert & Top selling
    expect(screen.getByText('Tomato')).toBeInTheDocument()
    expect(screen.getByText('Out of Stock')).toBeInTheDocument()
    expect(screen.getByText('Onion')).toBeInTheDocument()
    expect(screen.getByText('25 KG sold')).toBeInTheDocument()

    // Quick action links
    expect(screen.getByRole('link', { name: /add vegetable/i })).toHaveAttribute(
      'href',
      '/staff/catalog/new',
    )
    expect(screen.getByRole('link', { name: /create purchase/i })).toHaveAttribute(
      'href',
      '/staff/purchases/new',
    )
    expect(screen.getByRole('link', { name: /suppliers/i })).toHaveAttribute(
      'href',
      '/staff/suppliers',
    )
    expect(screen.getByRole('link', { name: /customer management/i })).toHaveAttribute(
      'href',
      '/staff/users',
    )

    // Recent activity
    expect(screen.getByText('Order #105')).toBeInTheDocument()
  })

  it('shows error state and empty states cleanly', async () => {
    vi.spyOn(reportOverviewApi, 'getOverview').mockRejectedValueOnce(new Error('Overview failed'))
    renderDashboard()
    expect(await screen.findByText(/overview failed/i)).toBeInTheDocument()

    vi.spyOn(reportOverviewApi, 'getOverview').mockResolvedValueOnce({
      kpis: {
        date: '2026-11-21',
        todaySales: '0.00',
        yesterdaySales: '0.00',
        salesChangeAmount: '0.00',
        salesChangePercent: null,
        todayOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: '0.00',
      },
      orderStatus: {
        pendingConfirmation: 0,
        confirmed: 0,
        preparing: 0,
        outForDelivery: 0,
        delivered: 0,
        cancelled: 0,
      },
      inventoryAlerts: [],
      topSellingToday: [],
      financials: {
        todayCashSales: '0.00',
        todayDigitalSales: '0.00',
        codCollected: '0.00',
        codSettledToShop: '0.00',
        codPendingSettlement: '0.00',
        supplierOutstandingPayable: '0.00',
      },
      recentActivity: [],
    })

    renderDashboard()
    expect(await screen.findByText(/no inventory alerts/i)).toBeInTheDocument()
    expect(screen.getByText(/no sales recorded today/i)).toBeInTheDocument()
    expect(screen.getByText(/no recent activity/i)).toBeInTheDocument()
  })
})
