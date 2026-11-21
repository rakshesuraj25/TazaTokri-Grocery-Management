import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouteGuard } from '@/components/RouteGuard'
import { useAuthStore } from '@/features/auth/store'
import PaymentsPage from '@/features/payments/pages/PaymentsPage'
import { paymentsApi } from '@/features/payments/api'
import type { SettlementResponse } from '@/features/payments/types'
import { ordersApi } from '@/features/orders/api'

function renderWithQuery(ui: React.ReactElement, initialEntries = ['/']) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('Admin & Staff Journey QA', () => {
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

  it('blocks STAFF from OWNER-only routes and allows OWNER', () => {
    useAuthStore.setState({
      user: {
        userId: 2,
        fullName: 'Staff User',
        phone: '8888888888',
        roles: ['STAFF'],
      },
    })

    renderWithQuery(
      <Routes>
        <Route element={<RouteGuard requiredRoles={['OWNER']} />}>
          <Route path="/staff/purchases/:id" element={<div>Purchase Detail</div>} />
        </Route>
        <Route path="/403" element={<div>Forbidden 403</div>} />
      </Routes>,
      ['/staff/purchases/42'],
    )

    expect(screen.getByText('Forbidden 403')).toBeInTheDocument()
  })

  it('validates COD cash settlement amount mismatch and blocks duplicate settlement while pending', async () => {
    const user = userEvent.setup()
    vi.spyOn(paymentsApi, 'listPendingCash').mockResolvedValue([
      {
        deliveryUserId: 10,
        fullName: 'Ramesh Rider',
        amount: '450.00',
        payments: 2,
      },
    ])
    vi.spyOn(ordersApi, 'listStaffOrders').mockResolvedValue([])

    let resolveSettle!: (v: SettlementResponse) => void
    const settleSpy = vi.spyOn(paymentsApi, 'settleCash').mockImplementation(
      () =>
        new Promise<SettlementResponse>((res) => {
          resolveSettle = res
        }),
    )

    renderWithQuery(<PaymentsPage />)

    await waitFor(() => expect(screen.getByText('Ramesh Rider')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /mark received/i }))

    const amtInput = screen.getByLabelText(/amount collected/i)
    await user.clear(amtInput)
    await user.type(amtInput, '400')
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(settleSpy).not.toHaveBeenCalled()

    await user.clear(amtInput)
    await user.type(amtInput, '450.00')
    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)
    await user.click(confirmBtn)

    expect(settleSpy).toHaveBeenCalledTimes(1)
    resolveSettle({
      deliveryUserId: 10,
      payments: 2,
      amount: '450.00',
      settledAt: '2026-11-21T13:20:00',
    })
  })
})
