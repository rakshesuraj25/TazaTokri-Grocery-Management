export type PaymentKind = 'COLLECTION' | 'REFUND'

export type PaymentMethod = 'CASH' | 'UPI_QR' | 'RAZORPAY'

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface PaymentRecord {
  id: number | string
  kind: PaymentKind
  method: PaymentMethod
  status: PaymentStatus
  amount: string | number
  collectedBy: number | string | null
  reference: string | null
  createdAt: string
  settledAt: string | null
}

export interface PendingCashItem {
  deliveryUserId: number | string
  fullName: string
  amount: string | number
  payments: number
}

export interface SettleCashRequest {
  deliveryUserId: number | string
  receivedAmount: string
}

export interface SettlementResponse {
  deliveryUserId: number | string
  amount: string | number
  payments: number
  settledAt: string
}
