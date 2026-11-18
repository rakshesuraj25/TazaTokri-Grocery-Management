import type { BaseUnit } from '@/features/catalog/types'

export type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'CUSTOM_WEEKDAY' | 'BIWEEKLY'
export type ScheduleStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED'

export interface BasketScheduleDto {
  id: number | string
  frequency: ScheduleFrequency
  preferredDayOfWeek: number | null
  nextReminderDate: string
  status: ScheduleStatus
  reminderDue: boolean
}

export interface SavedBasketItemDto {
  vegetableId: number | string
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  imageUrl?: string | null
  baseUnit: BaseUnit
  unitId: number | string
  unitLabel: string
  quantityInBaseUnit: string | number
  count: number
  currentUnitPrice: string | number | null
  estimatedLineTotal: string | number | null
  availableStock: string | number
  availableToday: boolean
}

export interface SavedBasketDto {
  id: number | string
  name: string
  estimatedTotal: string | number
  totalItemsCount: number
  unavailableItems: string[]
  schedule: BasketScheduleDto | null
  updatedAt: string
  items: SavedBasketItemDto[]
}

export interface BasketItemInput {
  vegetableId: number
  unitId: number
  count: number
}

export interface BasketUpsertRequest {
  name: string
  items: BasketItemInput[]
}

export interface ScheduleUpsertRequest {
  frequency: ScheduleFrequency
  preferredDayOfWeek?: number | null
}
