import type { BaseUnit } from '@/features/catalog/types'

export interface AiStatusResponse {
  enabled: boolean
  configured: boolean
  model: string
  maxUploadBytes: number
  supportedMimeTypes: string[]
  message: string
}

export interface PurchaseInvoiceDraftLineDto {
  rawItemName: string
  vegetableId: number | string | null
  matchedVegetableName: string | null
  baseUnit: BaseUnit | null
  quantity: string | number
  rawUnit: string
  ratePerUnit: string | number
  extractedLineTotal: string | number | null
  calculatedLineTotal: string | number
  lineTotalMismatch: boolean
  matched: boolean
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED' | string
  note?: string | null
}

export interface PurchaseInvoiceDraftDto {
  supplierName: string | null
  matchedSupplierId: number | string | null
  invoiceDate: string | null
  invoiceNumber: string | null
  transportCost: string | number
  invoiceGrandTotal: string | number | null
  calculatedItemsTotal: string | number
  calculatedGrandTotal: string | number
  totalMismatch: boolean
  totalMismatchWarning: string | null
  unmatchedItemsCount: number
  extractionSource: string
  warnings: string[]
  items: PurchaseInvoiceDraftLineDto[]
}

export interface QuickSaleDraftLineDto {
  rawLineText: string
  rawItemName: string
  vegetableId: number | string | null
  matchedVegetableName: string | null
  matchedNameMr?: string | null
  matchedNameHi?: string | null
  baseUnit: BaseUnit | null
  quantity: string | number
  rawUnit: string
  currentUnitPrice: string | number | null
  estimatedLineTotal: string | number | null
  availableStock: string | number | null
  stockSufficient: boolean
  matched: boolean
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED' | string
  warning?: string | null
}

export interface QuickSaleDraftDto {
  extractionSource: string
  totalExtractedCount: number
  matchedCount: number
  unmatchedCount: number
  estimatedSubtotal: string | number
  warnings: string[]
  items: QuickSaleDraftLineDto[]
}
