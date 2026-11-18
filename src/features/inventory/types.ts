import type { BaseUnit } from '@/features/catalog/types'

export type StockMovementType =
  | 'PURCHASE'
  | 'SHOP_SALE'
  | 'ONLINE_SALE'
  | 'WASTAGE'
  | 'ADJUSTMENT'
  | 'ONLINE_CANCEL_RETURN'

export interface StockSummary {
  vegetableId: number | string
  nameEn: string
  baseUnit: BaseUnit
  currentStock: string | number
}

export interface StockMovement {
  id: number | string
  type: StockMovementType
  /** Signed decimal quantity in base unit */
  quantity: string | number
  referenceType?: string | null
  referenceId?: number | string | null
  note?: string | null
  createdBy?: number | string | null
  createdAt: string
}

export interface RecordWastageRequest {
  vegetableId: number | string
  /** Strictly > 0 in base unit */
  quantity: string
  note?: string
}

export interface RecordAdjustmentRequest {
  vegetableId: number | string
  /** Signed, non-zero in base unit */
  quantity: string
  /** Required explanation for append-only ledger */
  note: string
}
