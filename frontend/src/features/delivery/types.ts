import type { OrderPaymentMethod } from '@/features/orders/types'

export type DeliveryStatus =
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'UNASSIGNED'

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
  customerName: string
  customerPhone: string
  paymentMethod: OrderPaymentMethod
  amountToCollect: string | number
  items: DeliveryOrderLine[]
}

export interface DeliverCollectionInput {
  method?: 'CASH' | 'UPI_QR'
  amountCollected?: string
  reference?: string
}
