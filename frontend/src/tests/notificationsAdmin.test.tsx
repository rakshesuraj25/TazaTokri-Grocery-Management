import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NotificationLogsPage, {
  ownerNotificationsApi,
} from '@/features/notifications/pages/NotificationLogsPage'

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <NotificationLogsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('NotificationLogsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('displays provider status without secrets, notification logs, and retries eligible FAILED log', async () => {
    const user = userEvent.setup()
    vi.spyOn(ownerNotificationsApi, 'getStatus').mockResolvedValue({
      cloudApiEnabled: true,
      shopSupportPhone: '9999999999',
      hasBusinessAccountId: true,
    })
    vi.spyOn(ownerNotificationsApi, 'getLogs').mockResolvedValue([
      {
        id: 1,
        orderId: 101,
        customerId: 1,
        eventType: 'ORDER_CONFIRMED',
        channel: 'WHATSAPP_CLOUD_API',
        language: 'EN',
        status: 'FAILED',
        errorDetail: 'HTTP 429 rate limited',
        createdAt: '2026-11-21T12:00:00',
      },
      {
        id: 2,
        orderId: 102,
        customerId: 2,
        eventType: 'ORDER_DELIVERED',
        channel: 'WHATSAPP_CLOUD_API',
        language: 'MR',
        status: 'SENT',
        errorDetail: null,
        createdAt: '2026-11-21T12:15:00',
      },
    ])
    const retrySpy = vi.spyOn(ownerNotificationsApi, 'retry').mockResolvedValue({
      id: 1,
      orderId: 101,
      customerId: 1,
      eventType: 'ORDER_CONFIRMED',
      channel: 'WHATSAPP_CLOUD_API',
      language: 'EN',
      status: 'SENT',
      errorDetail: null,
      createdAt: '2026-11-21T12:00:00',
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Cloud API Active')).toBeInTheDocument())
    expect(screen.getByText('#101')).toBeInTheDocument()
    expect(screen.getByText('HTTP 429 rate limited')).toBeInTheDocument()

    const retryButtons = screen.getAllByRole('button', { name: /retry/i })
    expect(retryButtons).toHaveLength(1)
    await user.click(retryButtons[0])

    await waitFor(() => expect(retrySpy).toHaveBeenCalledWith(1))
  })
})
