import type { OrderPaymentMethod, OrderStatus } from '@/features/orders/types'

export type DeliveryStatus =
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'UNASSIGNED'
  | 'RETURNED_TO_STORE'

export interface DeliveryPerson {
  id: number | string
  fullName: string
  phone: string
}

export interface DeliveryAttempt {
  id: number | string
  orderId: number | string
  deliveryUserId: number | string
  assignedBy: number | string
  status: DeliveryStatus
  assignedAt: string
  startedAt: string | null
  finishedAt: string | null
  failureReason: string | null
  otpVerified?: boolean
  otpVerifiedAt?: string | null
  otpVerificationMethod?: 'OTP' | 'MANUAL_OVERRIDE' | string | null
  otpOverrideReason?: string | null
  deliveryNote?: string | null
}

export interface DeliveryOrderLine {
  vegetable: string
  packedQuantity: string | number
  unit: string
}

export interface DeliveryOrder {
  orderId: number | string
  deliveryStatus: DeliveryStatus
  deliveryDate: string
  address: string
  pincode: string
  deliveryInstructions?: string | null
  customerName: string
  customerPhone: string
  paymentMethod: OrderPaymentMethod
  amountToCollect: string | number
  otpVerified?: boolean
  otpVerificationMethod?: 'OTP' | 'MANUAL_OVERRIDE' | string | null
  hasProofPhoto?: boolean
  latestProofEvidenceId?: number | string | null
  items: DeliveryOrderLine[]
}

export interface DeliverCollectionInput {
  method?: 'CASH' | 'UPI_QR'
  amountCollected?: string
  reference?: string
  recipientName?: string
  deliveryNote?: string
}

export interface OtpIssueResponse {
  orderId: number | string
  deliveryAttemptId: number | string
  expiresAt: string
  maxAttempts: number
  deliveryChannel: string
  maskedCustomerPhone: string
  message: string
}

export interface OtpVerifyResponse {
  verified: boolean
  verifiedAt: string
  verificationMethod: 'OTP' | 'MANUAL_OVERRIDE' | string
  remainingAttempts: number
  message: string
}

export interface DeliveryEvidenceResponse {
  id: number | string
  orderId: number | string
  deliveryAttemptId: number | string
  mimeType: string
  fileSizeBytes: number
  uploadedBy: number | string
  verificationMethod: string | null
  deliveryNote: string | null
  uploadedAt: string
  downloadPath: string
}

export interface DeliveryAuditLogResponse {
  id: number | string
  orderId: number | string
  deliveryAttemptId: number | string | null
  actionType: string
  fromStatus: string | null
  toStatus: string | null
  actorUserId: number | string
  actorRole: string | null
  note: string | null
  createdAt: string
}

export interface StaffDeliveryOrderItem {
  orderId: number | string
  orderStatus: OrderStatus
  deliveryStage:
    | 'READY_FOR_DELIVERY'
    | 'ASSIGNED'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'FAILED'
    | 'RETURNED_TO_STORE'
    | 'CANCELLED'
    | 'PREPARING'
    | string
  attemptStatus: DeliveryStatus | null
  attemptId: number | string | null
  deliveryDate: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  deliveryPincode: string
  locality: string
  deliveryInstructions: string | null
  orderAmount: string | number
  paymentMethod: OrderPaymentMethod
  paymentStatus: 'PAID' | 'COD_DUE' | string
  amountToCollect: string | number
  assignedDeliveryUserId: number | string | null
  assignedDeliveryUserName: string | null
  assignedDeliveryUserPhone: string | null
  otpVerified: boolean
  otpVerificationMethod: string | null
  hasProofPhoto: boolean
  latestProofEvidenceId: number | string | null
  failureReason: string | null
}

export interface GroupBucket {
  groupKey: string
  label: string
  orderCount: number
}

export interface StaffDeliveryBoardResponse {
  date: string
  readyForDeliveryCount: number
  assignedCount: number
  outForDeliveryCount: number
  deliveredCount: number
  failedCount: number
  cancelledCount: number
  byPincode: GroupBucket[]
  byLocality: GroupBucket[]
  byAssignee: GroupBucket[]
  orders: StaffDeliveryOrderItem[]
}
