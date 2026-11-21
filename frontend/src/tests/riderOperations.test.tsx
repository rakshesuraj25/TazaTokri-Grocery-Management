import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store'
import RiderOperationsPage from '@/features/delivery/pages/RiderOperationsPage'
import { riderOpsApi } from '@/features/delivery/riderOpsApi'

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <RiderOperationsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('RiderOperationsPage', () => {
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

  it('displays rider summary, COD settlement status, and loads rider delivery history', async () => {
    const user = userEvent.setup()
    vi.spyOn(riderOpsApi, 'getSummary').mockResolvedValue([
      {
        userId: 10,
        fullName: 'Ramesh Rider',
        phone: '9000011111',
        active: true,
        assignedCount: 2,
        outForDeliveryCount: 1,
        deliveredCount: 8,
        failedCount: 2,
        completionRate: 80,
        codCollectedTotal: 1500,
        codSettledTotal: 1100,
        codPendingSettlement: 400,
      },
    ])
    const historySpy = vi.spyOn(riderOpsApi, 'getHistory').mockResolvedValue([
      {
        id: 1,
        orderId: 101,
        deliveryUserId: 10,
        status: 'DELIVERED',
        assignedAt: '2026-11-21T10:00:00',
        startedAt: '2026-11-21T10:15:00',
        finishedAt: '2026-11-21T10:45:00',
        failureReason: null,
        otpVerified: true,
      },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Ramesh Rider')).toBeInTheDocument())
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getAllByText('₹400.00').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /history/i }))
    await waitFor(() => expect(historySpy).toHaveBeenCalledWith(10))
    expect(screen.getByText('Order #101')).toBeInTheDocument()
  })

  it('hides Settle COD button from STAFF role', async () => {
    useAuthStore.setState({
      user: {
        userId: 2,
        fullName: 'Staff User',
        phone: '8888888888',
        roles: ['STAFF'],
      },
    })
    vi.spyOn(riderOpsApi, 'getSummary').mockResolvedValue([
      {
        userId: 10,
        fullName: 'Ramesh Rider',
        phone: '9000011111',
        active: true,
        assignedCount: 1,
        outForDeliveryCount: 0,
        deliveredCount: 4,
        failedCount: 0,
        completionRate: 100,
        codCollectedTotal: 500,
        codSettledTotal: 0,
        codPendingSettlement: 500,
      },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Ramesh Rider')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /settle cod/i })).not.toBeInTheDocument()
  })
})
