import { api } from '@/lib/api'
import type {
  PaymentRecord,
  PendingCashItem,
  SettleCashRequest,
  SettlementResponse,
} from './types'

export const paymentsApi = {
  listOrderPayments: (orderId: number | string) =>
    api.get<PaymentRecord[]>(`/api/payments/orders/${orderId}`),

  /** OWNER only */
  listPendingCash: () => api.get<PendingCashItem[]>('/api/payments/cash-pending'),

  /** OWNER only */
  settleCash: (body: SettleCashRequest) =>
    api.post<SettlementResponse>('/api/payments/settle', {
      deliveryUserId: Number(body.deliveryUserId),
      receivedAmount: body.receivedAmount,
    }),

  /** OWNER only */
  processPendingRefunds: () =>
    api.post<{ refunded: number }>('/api/payments/refunds/process'),
}
