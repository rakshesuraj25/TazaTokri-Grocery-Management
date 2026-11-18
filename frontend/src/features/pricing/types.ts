import type { BaseUnit } from '@/features/catalog/types'

export type PriceSource = 'MANUAL' | 'SUGGESTED'

export interface CurrentPriceItem {
  vegetableId: number | string
  nameEn: string
  baseUnit: BaseUnit
  pricePerUnit: string | number
  source: PriceSource
  note?: string | null
  createdBy?: number | string | null
  createdAt: string
}

export interface SetPriceRequest {
  /** > 0, up to 2 decimal places */
  pricePerUnit: string
  note?: string
}

export interface MarkdownPriceRequest {
  /** > 0 and < currentPrice, up to 2 decimal places */
  markdownPricePerUnit: string
  reason?: string
}

export interface PriceSuggestion {
  vegetableId: number | string
  nameEn: string
  baseUnit: BaseUnit
  lookbackDays: number
  quantityBought: string | number
  averageLandedCost: string | number
  wastagePercent: string | number
  costWithWastage: string | number
  marginPercent: string | number
  suggestedPrice: string | number
  currentPrice: string | number | null
}
