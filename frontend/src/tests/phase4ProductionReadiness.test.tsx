import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import { StaffDeliveryBoardPanel } from '@/features/delivery/components/StaffDeliveryBoardPanel'
import { DeliveryOrderCard } from '@/features/delivery/components/DeliveryOrderCard'
import { DeliverOrderDialog } from '@/features/delivery/components/DeliveryModals'
import { OperationalHealthCard } from '@/features/report/components/OperationalHealthCard'
import {
  captureFrontendError,
  isFrontendSentryEnabled,
  scrubSensitiveFrontendText,
} from '@/lib/sentry'
import type { DeliveryOrder } from '@/features/delivery/types'

const mockIssueOtp = vi.fn()
const mockVerifyOtp = vi.fn()
const mockManualOverride = vi.fn()
const mockReturnToStore = vi.fn()

vi.mock('@/features/delivery/hooks', () => ({
  useStaffDeliveryBoard: () => ({
    data: {
      date: '2026-11-18',
      readyForDeliveryCount: 1,
      assignedCount: 1,
      outForDeliveryCount: 1,
      deliveredCount: 0,
      failedCount: 1,
      cancelledCount: 0,
      byPincode: [{ groupKey: '411038', label: 'PIN 411038', orderCount: 3 }],
      byLocality: [{ groupKey: 'Kothrud', label: 'Kothrud', orderCount: 3 }],
      byAssignee: [{ groupKey: '2', label: 'Sunil Driver', orderCount: 2 }],
      orders: [
        {
          orderId: 901,
          orderStatus: 'PACKED',
          deliveryStage: 'READY_FOR_DELIVERY',
          attemptStatus: null,
          attemptId: null,
          deliveryDate: '2026-11-18',
          customerName: 'Anita Deshmukh',
          customerPhone: '9888888888',
          deliveryAddress: 'Flat 5, Kothrud, Pune',
          deliveryPincode: '411038',
          locality: 'Kothrud',
          deliveryInstructions: 'Leave with security guard',
          orderAmount: '230.00',
          paymentMethod: 'COD',
          paymentStatus: 'COD_DUE',
          amountToCollect: '230.00',
          assignedDeliveryUserId: null,
          assignedDeliveryUserName: null,
          assignedDeliveryUserPhone: null,
          otpVerified: false,
          otpVerificationMethod: null,
          hasProofPhoto: false,
          latestProofEvidenceId: null,
          failureReason: null,
        },
        {
          orderId: 902,
          orderStatus: 'PACKED',
          deliveryStage: 'FAILED',
          attemptStatus: 'FAILED',
          attemptId: 44,
          deliveryDate: '2026-11-18',
          customerName: 'Rohan Joshi',
          customerPhone: '9777777777',
          deliveryAddress: 'Lane 2, Kothrud, Pune',
          deliveryPincode: '411038',
          locality: 'Kothrud',
          deliveryInstructions: null,
          orderAmount: '180.00',
          paymentMethod: 'ONLINE',
          paymentStatus: 'PAID',
          amountToCollect: '0.00',
          assignedDeliveryUserId: 2,
          assignedDeliveryUserName: 'Sunil Driver',
          assignedDeliveryUserPhone: '9111111111',
          otpVerified: false,
          otpVerificationMethod: null,
          hasProofPhoto: false,
          latestProofEvidenceId: null,
          failureReason: 'Customer unavailable',
        },
      ],
    },
  }),
  useReturnDeliveryToStore: () => ({
    isPending: false,
    mutate: (
      input: unknown,
      opts?: { onSuccess?: () => void; onError?: (err: unknown) => void },
    ) => {
      mockReturnToStore(input)
      opts?.onSuccess?.()
    },
  }),
  useIssueDeliveryOtp: () => ({
    isPending: false,
    mutate: (
      orderId: unknown,
      opts?: { onSuccess?: (res: unknown) => void; onError?: (err: unknown) => void },
    ) => {
      mockIssueOtp(orderId)
      opts?.onSuccess?.({
        orderId,
        deliveryAttemptId: 10,
        expiresAt: '2026-11-18T12:00:00',
        maxAttempts: 5,
        deliveryChannel: 'CUSTOMER_FALLBACK',
        maskedCustomerPhone: '******8888',
        message: '6-digit OTP generated for order #901 (******8888).',
      })
    },
  }),
  useVerifyDeliveryOtp: () => ({
    isPending: false,
    mutate: (
      input: { orderId: unknown; otp: string },
      opts?: { onSuccess?: (res: unknown) => void; onError?: (err: unknown) => void },
    ) => {
      mockVerifyOtp(input)
      opts?.onSuccess?.({
        verified: true,
        verifiedAt: '2026-11-18T11:45:00',
        verificationMethod: 'OTP',
        remainingAttempts: 4,
        message: 'Delivery OTP verified successfully.',
      })
    },
  }),
  useManualOtpOverride: () => ({
    isPending: false,
    mutate: (
      input: unknown,
      opts?: { onSuccess?: (res: unknown) => void; onError?: (err: unknown) => void },
    ) => {
      mockManualOverride(input)
      opts?.onSuccess?.({
        verified: true,
        verifiedAt: '2026-11-18T11:46:00',
        verificationMethod: 'MANUAL_OVERRIDE',
        remainingAttempts: 0,
        message: 'Manual delivery verification recorded with audit trail.',
      })
    },
  }),
  useUploadDeliveryProof: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useMarkDelivered: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useMarkFailed: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}))

vi.mock('@/features/report/hooks', () => ({
  useOperationalHealth: () => ({
    data: {
      status: 'UP',
      databaseConnected: true,
      applicationVersion: '0.4.0',
      environment: 'production',
      timestampIst: '2026-11-18T23:55:00',
      providers: {
        whatsappCloudConfigured: false,
        geminiAiConfigured: false,
        razorpayConfigured: false,
        sentryConfigured: false,
        proofStorageProvider: 'LOCAL',
      },
      lastBackup: {
        available: true,
        status: 'SUCCESS',
        lastBackupAt: '2026-11-18T23:54:29+05:30',
        backupFileName: 'tazatokri_backup_20261118_235429.sql',
        fileSizeBytes: 21384,
      },
    },
  }),
}))

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('Phase 4 — Delivery Dispatch, OTP, Proof of Delivery, Health & Sentry Scrubbing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders StaffDeliveryBoardPanel with PIN/locality/person grouping and Return to Store action', () => {
    const onAssign = vi.fn()
    render(<StaffDeliveryBoardPanel date="2026-11-18" onRequestAssign={onAssign} />, {
      wrapper: createWrapper(),
    })

    const panel = screen.getByTestId('staff-delivery-board-panel')
    expect(panel.textContent).toContain('PIN 411038 (3)')
    expect(panel.textContent).toContain('Kothrud (3)')
    expect(panel.textContent).toContain('Sunil Driver (2)')
    expect(panel.textContent).toContain('Anita Deshmukh')
    expect(panel.textContent).toContain('Leave with security guard')

    fireEvent.click(screen.getByRole('button', { name: /Return to Store/i }))
    expect(mockReturnToStore).toHaveBeenCalledWith({
      orderId: 902,
      note: 'Failed delivery package returned to store',
    })
  })

  it('renders delivery instructions, map link, OTP verification, manual override, and POD upload in Delivery flow', async () => {
    const order: DeliveryOrder = {
      orderId: 901,
      deliveryStatus: 'OUT_FOR_DELIVERY',
      deliveryDate: '2026-11-18',
      address: 'Flat 5, Kothrud, Pune',
      pincode: '411038',
      deliveryInstructions: 'Leave with security guard',
      customerName: 'Anita Deshmukh',
      customerPhone: '9888888888',
      paymentMethod: 'COD',
      amountToCollect: '230.00',
      otpVerified: false,
      hasProofPhoto: false,
      items: [{ vegetable: 'Tomato', packedQuantity: '2.000', unit: 'KG' }],
    }

    render(
      <>
        <DeliveryOrderCard
          order={order}
          startPending={false}
          onStart={() => {}}
          onDeliver={() => {}}
          onFail={() => {}}
        />
        <DeliverOrderDialog order={order} onClose={() => {}} />
      </>,
      { wrapper: createWrapper() },
    )

    expect(screen.getByTestId('delivery-order-card-901').textContent).toContain(
      'Leave with security guard',
    )

    const otpSection = screen.getByTestId('delivery-otp-section')
    expect(otpSection).toBeTruthy()
    expect(screen.getByTestId('delivery-pod-section')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Send \/ Issue 6-Digit OTP/i }))
    expect(mockIssueOtp).toHaveBeenCalledWith(901)

    const otpInput = screen.getByPlaceholderText('6-digit OTP')
    fireEvent.change(otpInput, { target: { value: '654321' } })
    fireEvent.click(screen.getByRole('button', { name: /Verify OTP/i }))

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({ orderId: 901, otp: '654321' })
    })
  })

  it('renders OperationalHealthCard and scrubs secrets/OTPs in frontend Sentry utility', () => {
    render(<OperationalHealthCard />, { wrapper: createWrapper() })
    const card = screen.getByTestId('operational-health-card')
    expect(card.textContent).toContain('Connected & Healthy')
    expect(card.textContent).toContain('tazatokri_backup_20261118_235429.sql')
    expect(card.textContent).toContain('POD: LOCAL')

    expect(isFrontendSentryEnabled()).toBe(false)
    const scrubbed = scrubSensitiveFrontendText(
      'Failed with Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig and otp=123456 password=Secret123',
    )
    expect(scrubbed).not.toContain('payload')
    expect(scrubbed).not.toContain('123456')
    expect(scrubbed).not.toContain('Secret123')

    const captured = captureFrontendError(new Error('token=myJwt999'), 'TEST')
    expect(captured.message).not.toContain('myJwt999')
  })
})
