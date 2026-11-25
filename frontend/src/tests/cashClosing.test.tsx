import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CashClosingPage from '@/features/report/pages/CashClosingPage'
import { cashClosingApi, type DailyCashTally } from '@/features/report/cashClosingApi'
import { todayIST } from '@/lib/dates'

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <CashClosingPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const sampleOpenTally: DailyCashTally = {
  date: todayIST(),
  status: 'OPEN',
  openingCash: 500,
  suggestedOpeningCash: 500,
  shopCashSales: 1200,
  shopCashBills: 5,
  posUpiSales: 850,
  posUpiBills: 3,
  codCashCollected: 900,
  codCashBills: 4,
  codCashSettledToShop: 600,
  codCashPendingSettlement: 300,
  deliveryUpiCollections: 400,
  razorpayCollections: 350,
  cashRefunds: 50,
  digitalRefunds: 100,
  purchaseSpend: 2500,
  cashExpenses: 0,
  expenseNote: null,
  expectedCash: 2250,
  actualCashCounted: null,
  difference: null,
  note: null,
  closedBy: null,
  closedAt: null,
  hasTransactions: true,
}

describe('CashClosingPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cashClosingApi, 'getHistory').mockResolvedValue([])
  })

  it('computes expected cash, highlights short/excess difference, and prevents duplicate closing', async () => {
    const user = userEvent.setup()
    vi.spyOn(cashClosingApi, 'getTally').mockResolvedValue(sampleOpenTally)

    const closedResponse: DailyCashTally = {
      ...sampleOpenTally,
      status: 'CLOSED',
      openingCash: 500,
      cashExpenses: 150,
      expenseNote: 'Ice & bags',
      expectedCash: 2100,
      actualCashCounted: 2050,
      difference: -50,
      note: 'Rs 50 short',
      closedBy: '9999999999',
      closedAt: '2026-11-21T20:15:00',
    }
    const closeSpy = vi.spyOn(cashClosingApi, 'closeDay').mockResolvedValue(closedResponse)

    renderPage()

    await waitFor(() => expect(screen.getByText(/shop cash sales \(pos\)/i)).toBeInTheDocument())

    const expensesInput = screen.getByLabelText(/cash drawer expenses/i)
    await user.clear(expensesInput)
    await user.type(expensesInput, '150')

    const countedInput = screen.getByLabelText(/actual physical cash counted/i)
    await user.type(countedInput, '2050')

    // Expected = 500 + 1200 + 600 - 150 - 50 = 2100; Counted = 2050 -> Short ₹50.00
    expect(screen.getByText(/short ₹50\.00/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /complete daily closing/i }))

    await waitFor(() => expect(closeSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(/closing summary/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /complete daily closing/i })).not.toBeInTheDocument()
  })

  it('shows empty state when there are no transactions and validates negative cash counted', async () => {
    const user = userEvent.setup()
    vi.spyOn(cashClosingApi, 'getTally').mockResolvedValue({
      ...sampleOpenTally,
      shopCashSales: 0,
      shopCashBills: 0,
      posUpiSales: 0,
      posUpiBills: 0,
      codCashCollected: 0,
      codCashBills: 0,
      codCashSettledToShop: 0,
      codCashPendingSettlement: 0,
      deliveryUpiCollections: 0,
      razorpayCollections: 0,
      cashRefunds: 0,
      digitalRefunds: 0,
      purchaseSpend: 0,
      expectedCash: 500,
      hasTransactions: false,
    })

    renderPage()

    await waitFor(() =>
      expect(screen.getByText(/no transactions recorded for/i)).toBeInTheDocument(),
    )

    const countedInput = screen.getByLabelText(/actual physical cash counted/i)
    await user.type(countedInput, '-10')
    await user.click(screen.getByRole('button', { name: /complete daily closing/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/0 or greater/i)
  })
})
