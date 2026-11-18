import type { BaseUnit } from '@/features/catalog/types'

export type SalePaymentMethod = 'CASH' | 'UPI'

export interface CreateSaleItemInput {
  vegetableId: number | string
  /** Quantity in vegetable's BASE unit (> 0, max 3 decimals) */
  quantity: string
}

export interface CreateSaleRequest {
  /** Idempotency key generated ONCE per bill attempt and reused on retry */
  clientRef: string
  paymentMethod: SalePaymentMethod
  items: CreateSaleItemInput[]
}

export interface SaleItemResponse {
  vegetableId: number | string
  vegetableName: string
  baseUnit?: BaseUnit | null
  quantity: string | number
  unitPrice: string | number
  lineTotal: string | number
}

export interface SaleResponse {
  id: number | string
  createdAt: string
  paymentMethod: SalePaymentMethod
  totalAmount: string | number
  soldBy: number | string
  items: SaleItemResponse[]
}
