import type { BaseUnit } from '@/features/catalog/types'

export interface ComboItemDto {
  vegetableId: number | string
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  imageUrl?: string | null
  baseUnit: BaseUnit
  unitLabel: string
  quantityInBaseUnit: string | number
  currentPricePerUnit: string | number | null
  regularLinePrice: string | number | null
  inStock: boolean
}

export interface ComboDto {
  id: number | string
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  descriptionEn?: string | null
  descriptionMr?: string | null
  descriptionHi?: string | null
  imageUrl?: string | null
  sellingPrice: string | number
  regularCombinedPrice: string | number | null
  savingsAmount: string | number
  active: boolean
  available: boolean
  inStock: boolean
  maxAvailableCombos: number
  items: ComboItemDto[]
}

export interface ComboItemInput {
  vegetableId: number
  unitLabel: string
  quantityInBaseUnit: string
}

export interface ComboUpsertRequest {
  nameEn: string
  nameMr?: string
  nameHi?: string
  descriptionEn?: string
  descriptionMr?: string
  descriptionHi?: string
  imageUrl?: string
  sellingPrice: string
  available?: boolean
  items: ComboItemInput[]
}
