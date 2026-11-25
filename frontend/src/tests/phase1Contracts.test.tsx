import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { useAuthStore } from '@/features/auth/store'
import { useMe } from '@/features/auth/hooks'
import DeliveryOrdersPage from '@/features/delivery/pages/DeliveryOrdersPage'
import type { DeliveryOrder, DeliveryStatus } from '@/features/delivery/types'
import type {
  PaymentKind,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
} from '@/features/payments/types'

function MeProbe() {
  useMe()
  const user = useAuthStore((s) => s.user)
  return (
    <div>
      <span data-testid="me-phone">{user?.phone ?? 'none'}</span>
      <span data-testid="me-roles">{user?.roles.join(',') ?? 'none'}</span>
    </div>
  )
}

describe('Phase 1 contract & security corrections', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.getState().logout()
  })

  it('stores JWT strictly in localStorage["token"] and never inside tazatokri-auth', () => {
    useAuthStore.getState().setUser(
      {
        userId: 5,
        fullName: 'Asha Owner',
        roles: ['OWNER'],
        expiresInMinutes: 60,
      },
      'secret-jwt-value',
    )

    expect(localStorage.getItem('token')).toBe('secret-jwt-value')
    const rawPersisted = localStorage.getItem('tazatokri-auth')
    expect(rawPersisted).toBeTruthy()
    expect(rawPersisted).not.toContain('secret-jwt-value')
    const parsed = JSON.parse(rawPersisted!) as { state: { user: Record<string, unknown> } }
    expect('token' in parsed.state.user).toBe(false)
    expect(parsed.state.user.fullName).toBe('Asha Owner')
  })

  it('hydrates /api/me defensively when userId and fullName are absent and roles are Spring string', async () => {
    localStorage.setItem('token', 'token-only-session')

    server.use(
      http.get('*/api/me', () =>
        HttpResponse.json({ phone: '9888877777', roles: '[ROLE_STAFF, ROLE_DELIVERY]' }),
      ),
    )

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <MeProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('me-roles')).toHaveTextContent('STAFF,DELIVERY')
    })
    expect(screen.getByTestId('me-phone')).toHaveTextContent('9888877777')
    expect(useAuthStore.getState().user?.userId).toBeUndefined()
    expect(useAuthStore.getState().user?.fullName).toBeUndefined()
  })

  it('matches exact backend Payment and Delivery enums and renders OUT_FOR_DELIVERY actions', async () => {
    const validDeliveryStatuses: DeliveryStatus[] = [
      'ASSIGNED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'FAILED',
      'UNASSIGNED',
    ]
    const validPaymentKinds: PaymentKind[] = ['COLLECTION', 'REFUND']
    const validPaymentMethods: PaymentMethod[] = ['CASH', 'UPI_QR', 'RAZORPAY']
    const validPaymentStatuses: PaymentStatus[] = ['PENDING', 'SUCCESS', 'FAILED']

    const paymentSample: PaymentRecord = {
      id: 1,
      kind: validPaymentKinds[0],
      method: validPaymentMethods[1],
      status: validPaymentStatuses[1],
      amount: '180.00',
      collectedBy: 3,
      reference: 'UPI-1234',
      createdAt: '2026-11-15T09:00:00Z',
      settledAt: null,
    }
    expect(paymentSample.status).toBe('SUCCESS')
    expect(validDeliveryStatuses).toHaveLength(5)

    const order: DeliveryOrder = {
      orderId: 42,
      deliveryStatus: 'OUT_FOR_DELIVERY',
      deliveryDate: '2026-11-15',
      address: 'Baner Road',
      pincode: '411026',
      customerName: 'Kiran',
      customerPhone: '9876501234',
      paymentMethod: 'COD',
      amountToCollect: '180.00',
      items: [{ vegetable: 'Tomato', packedQuantity: '1.000', unit: 'KG' }],
    }

    server.use(http.get('*/api/delivery/orders', () => HttpResponse.json([order])))

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <DeliveryOrdersPage />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('#42')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delivered$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^unable to deliver$/i })).toBeInTheDocument()
  })
})
