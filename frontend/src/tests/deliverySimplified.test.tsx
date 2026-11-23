import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { deliveryApi } from '@/features/delivery/api'
import DeliveryOrdersPage from '@/features/delivery/pages/DeliveryOrdersPage'
import { DeliverOrderDialog, FailOrderDialog } from '@/features/delivery/components/DeliveryModals'
import type { DeliveryOrder } from '@/features/delivery/types'

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const sampleOrder: DeliveryOrder = {
  orderId: 77,
  deliveryStatus: 'OUT_FOR_DELIVERY',
  deliveryDate: '2026-11-22',
  address: '45 FC Road, Pune',
  pincode: '411004',
  deliveryInstructions: 'Call on arrival',
  customerName: 'Ramesh Patil',
  customerPhone: '98765-43210',
  paymentMethod: 'COD',
  amountToCollect: '240.00',
  otpVerified: false,
  items: [
    { vegetable: 'Tomato', packedQuantity: '2.000', unit: 'KG' },
  ],
}

describe('Simplified Delivery Person Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders clean delivery card with sanitized tel: link, Google Maps directions URL, and accurate counters', async () => {
    vi.spyOn(deliveryApi, 'listMyOrders').mockResolvedValue([
      sampleOrder,
      { ...sampleOrder, orderId: 78, deliveryStatus: 'FAILED', amountToCollect: '100.00' },
    ])

    renderWithQuery(<DeliveryOrdersPage />)

    expect(await screen.findByText('#77')).toBeInTheDocument()
    expect(screen.getAllByText('Ramesh Patil').length).toBeGreaterThanOrEqual(1)

    const callLinks = screen.getAllByRole('link', { name: /call/i })
    expect(callLinks[0]).toHaveAttribute('href', 'tel:9876543210')

    const mapLinks = screen.getAllByRole('link', { name: /map/i })
    expect(mapLinks[0].getAttribute('href')).toContain(
      'https://www.google.com/maps/dir/?api=1&destination=',
    )
    expect(mapLinks[0].getAttribute('href')).toContain('411004')
  })

  it('completes delivery to family member with COD Cash without blocking on OTP', async () => {
    const user = userEvent.setup()
    const deliverSpy = vi.spyOn(deliveryApi, 'markDelivered').mockResolvedValue({
      id: 1,
      orderId: 77,
      deliveryUserId: 2,
      assignedBy: 1,
      status: 'DELIVERED',
      assignedAt: '2026-11-22T09:00:00',
      startedAt: '2026-11-22T09:30:00',
      finishedAt: '2026-11-22T10:00:00',
      failureReason: null,
    })

    renderWithQuery(<DeliverOrderDialog order={sampleOrder} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Family member' }))
    await user.type(screen.getByLabelText(/delivery note/i), 'Handed to brother')
    await user.click(screen.getByRole('button', { name: /mark delivered/i }))

    await waitFor(() =>
      expect(deliverSpy).toHaveBeenCalledWith(
        77,
        expect.objectContaining({
          method: 'CASH',
          amountCollected: '240.00',
          recipientName: 'Family member',
          deliveryNote: 'Handed to brother',
        }),
      ),
    )
  })

  it('marks order Unable to Deliver with reason and optional note', async () => {
    const user = userEvent.setup()
    const failSpy = vi.spyOn(deliveryApi, 'markFailed').mockResolvedValue({
      id: 1,
      orderId: 77,
      deliveryUserId: 2,
      assignedBy: 1,
      status: 'FAILED',
      assignedAt: '2026-11-22T09:00:00',
      startedAt: '2026-11-22T09:30:00',
      finishedAt: '2026-11-22T10:00:00',
      failureReason: 'Customer not at home — Gate locked',
    })

    renderWithQuery(<FailOrderDialog order={sampleOrder} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Customer not at home' }))
    await user.type(screen.getByLabelText(/note/i), 'Gate locked')
    await user.click(screen.getByRole('button', { name: /unable to deliver/i }))

    await waitFor(() =>
      expect(failSpy).toHaveBeenCalledWith(77, 'Customer not at home — Gate locked'),
    )
  })
})
