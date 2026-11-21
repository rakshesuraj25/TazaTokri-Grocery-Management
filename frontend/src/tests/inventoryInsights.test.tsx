import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  inventoryInsightsApi,
  type InventoryInsightsDashboard,
} from '@/features/inventory/insightsApi'
import InventoryInsightsPage from '@/features/inventory/pages/InventoryInsightsPage'

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InventoryInsightsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function makeDashboard(horizon: 3 | 7 | 14): InventoryInsightsDashboard {
  const tomatoSuggested = horizon === 3 ? '6.000' : horizon === 14 ? '28.000' : '14.000'
  return {
    planningHorizonDays: horizon,
    totalActiveProducts: 3,
    activelySellingCount: 2,
    atRiskCount: 1,
    criticalRiskCount: 1,
    highRiskCount: 0,
    lowDemandCount: 1,
    totalInventoryByUnit: { KG: '50.000', BUNCH: '10.000' },
    estimatedInventoryValue: '1250.00',
    valuedProductsCount: 2,
    uncostedProductsCount: 1,
    bestSelling: [
      {
        vegetableId: 1,
        name: 'Tomato',
        unit: 'KG',
        currentStock: '0.000',
        totalQtySold30d: '60.000',
        totalQtySold7d: '28.000',
        orderCount30d: 18,
        avgDailyDemand: '2.000',
        avgDailyLast7d: '4.000',
        avgDailyLast30d: '2.000',
        salesTrend: 'INCREASING',
        daysRemaining: '0.0',
        stockoutRisk: 'CRITICAL',
        forecastDemand: String(horizon * 2),
        suggestedPurchaseQty: tomatoSuggested,
        recommendationReason: `Est. 0.0 days of stock left at 2 KG/day; recommend buying ${tomatoSuggested} KG.`,
        avgLandedCost: '25.00',
        estimatedStockValue: '0.00',
      },
    ],
    slowMoving: [
      {
        vegetableId: 3,
        name: 'Coriander',
        unit: 'BUNCH',
        currentStock: '10.000',
        totalQtySold30d: '0.000',
        totalQtySold7d: '0.000',
        orderCount30d: 0,
        avgDailyDemand: '0.000',
        avgDailyLast7d: '0.000',
        avgDailyLast30d: '0.000',
        salesTrend: 'NO_DATA',
        daysRemaining: null,
        stockoutRisk: 'NO_DATA',
        forecastDemand: '0.000',
        suggestedPurchaseQty: '0.000',
        recommendationReason: 'No sales in the last 30 days; insufficient data for forecasting.',
        avgLandedCost: null,
        estimatedStockValue: null,
      },
    ],
    increasingDemand: [],
    decreasingDemand: [],
    products: [
      {
        vegetableId: 1,
        name: 'Tomato',
        unit: 'KG',
        currentStock: '0.000',
        totalQtySold30d: '60.000',
        totalQtySold7d: '28.000',
        orderCount30d: 18,
        avgDailyDemand: '2.000',
        avgDailyLast7d: '4.000',
        avgDailyLast30d: '2.000',
        salesTrend: 'INCREASING',
        daysRemaining: '0.0',
        stockoutRisk: 'CRITICAL',
        forecastDemand: String(horizon * 2),
        suggestedPurchaseQty: tomatoSuggested,
        recommendationReason: `Est. 0.0 days of stock left at 2 KG/day; recommend buying ${tomatoSuggested} KG.`,
        avgLandedCost: '25.00',
        estimatedStockValue: '0.00',
      },
      {
        vegetableId: 2,
        name: 'Potato',
        unit: 'KG',
        currentStock: '50.000',
        totalQtySold30d: '30.000',
        totalQtySold7d: '3.500',
        orderCount30d: 10,
        avgDailyDemand: '1.000',
        avgDailyLast7d: '0.500',
        avgDailyLast30d: '1.000',
        salesTrend: 'DECREASING',
        daysRemaining: '50.0',
        stockoutRisk: 'LOW',
        forecastDemand: String(horizon),
        suggestedPurchaseQty: '0.000',
        recommendationReason: 'Sufficient stock (~50.0 days remaining).',
        avgLandedCost: '25.00',
        estimatedStockValue: '1250.00',
      },
      {
        vegetableId: 3,
        name: 'Coriander',
        unit: 'BUNCH',
        currentStock: '10.000',
        totalQtySold30d: '0.000',
        totalQtySold7d: '0.000',
        orderCount30d: 0,
        avgDailyDemand: '0.000',
        avgDailyLast7d: '0.000',
        avgDailyLast30d: '0.000',
        salesTrend: 'NO_DATA',
        daysRemaining: null,
        stockoutRisk: 'NO_DATA',
        forecastDemand: '0.000',
        suggestedPurchaseQty: '0.000',
        recommendationReason: 'No sales in the last 30 days; insufficient data for forecasting.',
        avgLandedCost: null,
        estimatedStockValue: null,
      },
    ],
  }
}

describe('Inventory Forecasting & Demand Insights', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as never
  })

  it('renders KPIs, changes planning horizon, filters/sorts, and adjusts suggested purchase', async () => {
    const user = userEvent.setup()
    const spy = vi
      .spyOn(inventoryInsightsApi, 'getDashboard')
      .mockImplementation(async (horizon = 7) => makeDashboard(horizon))

    renderPage()

    expect(await screen.findByText('₹1,250.00')).toBeInTheDocument()
    expect(screen.getAllByText('Tomato').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Potato')).toBeInTheDocument()

    // Expand Tomato recommendation details
    await user.click(screen.getByRole('button', { name: /toggle details for tomato/i }))
    expect(await screen.findByText(/est\. 0\.0 days of stock left/i)).toBeInTheDocument()

    // Change planning horizon to 14 Days
    await user.click(screen.getByRole('button', { name: '14 Days' }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith(14))
    const buyInput = screen.getByLabelText('Buy (KG):', { selector: '#buy-1' }) as HTMLInputElement
    await waitFor(() => expect(buyInput.value).toBe('28.000'))

    // Adjust suggested quantity manually
    await user.clear(buyInput)
    await user.type(buyInput, '30')
    expect(buyInput.value).toBe('30')

    // Filter by CRITICAL risk
    await user.selectOptions(screen.getByLabelText(/filter by stockout risk/i), 'CRITICAL')
    expect(screen.queryByText('Potato')).not.toBeInTheDocument()
    expect(screen.getAllByText('Tomato').length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading, empty, and error states cleanly', async () => {
    vi.spyOn(inventoryInsightsApi, 'getDashboard').mockRejectedValueOnce(new Error('Network error'))
    renderPage()
    expect(await screen.findByText(/network error/i)).toBeInTheDocument()

    vi.spyOn(inventoryInsightsApi, 'getDashboard').mockResolvedValueOnce({
      planningHorizonDays: 7,
      totalActiveProducts: 0,
      activelySellingCount: 0,
      atRiskCount: 0,
      criticalRiskCount: 0,
      highRiskCount: 0,
      lowDemandCount: 0,
      totalInventoryByUnit: {},
      estimatedInventoryValue: null,
      valuedProductsCount: 0,
      uncostedProductsCount: 0,
      bestSelling: [],
      slowMoving: [],
      increasingDemand: [],
      decreasingDemand: [],
      products: [],
    })
    renderPage()
    expect(await screen.findByText(/no active products found/i)).toBeInTheDocument()
  })
})
