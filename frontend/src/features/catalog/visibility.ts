import { dec } from '@/lib/money'

export type ProductVisibilityCode = 'PUBLISHED' | 'HIDDEN_STOCKED' | 'OUT_OF_STOCK' | 'INACTIVE'

export interface ProductVisibilityInput {
  active?: boolean
  available: boolean
  pricePerUnit: string | number | null | undefined
  stock: string | number | null | undefined
}

export interface ProductVisibilityStatus {
  code: ProductVisibilityCode
  label: string
  reasons: string[]
  hasStock: boolean
  missingPrice: boolean
  notAvailableToday: boolean
  isPublished: boolean
  badgeVariant: 'success' | 'warning' | 'destructive' | 'secondary'
}

function safeStock(stock: string | number | null | undefined) {
  try {
    return dec(stock ?? 0)
  } catch {
    return dec(0)
  }
}

function hasValidPrice(pricePerUnit: string | number | null | undefined): boolean {
  if (pricePerUnit === null || pricePerUnit === undefined || pricePerUnit === '') {
    return false
  }
  try {
    return dec(pricePerUnit).gt(0)
  } catch {
    return false
  }
}

export function deriveProductVisibility(input: ProductVisibilityInput): ProductVisibilityStatus {
  const active = input.active !== false
  const hasStock = safeStock(input.stock).gt(0)
  const missingPrice = !hasValidPrice(input.pricePerUnit)
  const notAvailableToday = !input.available

  if (!active) {
    return {
      code: 'INACTIVE',
      label: 'Inactive',
      reasons: ['Inactive in catalog'],
      hasStock,
      missingPrice,
      notAvailableToday,
      isPublished: false,
      badgeVariant: 'secondary',
    }
  }

  if (!hasStock) {
    return {
      code: 'OUT_OF_STOCK',
      label: 'Out of stock',
      reasons: ['Out of stock'],
      hasStock: false,
      missingPrice,
      notAvailableToday,
      isPublished: false,
      badgeVariant: 'destructive',
    }
  }

  const reasons: string[] = []
  if (missingPrice) {
    reasons.push('Missing selling price')
  }
  if (notAvailableToday) {
    reasons.push('Not marked Available Today')
  }

  if (reasons.length > 0) {
    return {
      code: 'HIDDEN_STOCKED',
      label: 'Stock available, hidden',
      reasons,
      hasStock: true,
      missingPrice,
      notAvailableToday,
      isPublished: false,
      badgeVariant: 'warning',
    }
  }

  return {
    code: 'PUBLISHED',
    label: 'Published',
    reasons: [],
    hasStock: true,
    missingPrice: false,
    notAvailableToday: false,
    isPublished: true,
    badgeVariant: 'success',
  }
}
