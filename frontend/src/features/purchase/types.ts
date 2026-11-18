export type SupplierType = 'FARMER' | 'WHOLESALE_MARKET' | 'OTHER'

export interface Supplier {
  id: number | string
  name: string
  type: SupplierType
  phone?: string | null
  active: boolean
}

export interface CreateSupplierRequest {
  name: string
  type: SupplierType
  phone?: string
}

export interface CreatePurchaseItemInput {
  vegetableId: number | string
  /** Quantity in vegetable's BASE unit (> 0, max 3 dp) */
  quantity: string
  /** Rate per base unit (> 0, max 2 dp) */
  ratePerUnit: string
}

export interface CreatePurchaseRequest {
  supplierId: number | string
  /** YYYY-MM-DD (must not be in the future) */
  purchaseDate: string
  transportCost: string
  note?: string
  items: CreatePurchaseItemInput[]
}

export interface PurchaseItemResponse {
  vegetableId: number | string
  vegetableName: string
  quantity: string | number
  ratePerUnit: string | number
  lineCost: string | number
  transportShare: string | number
  landedCostPerUnit: string | number
}

export interface PurchaseResponse {
  id: number | string
  supplierId: number | string
  supplierName: string
  purchaseDate: string
  transportCost: string | number
  totalCost: string | number
  note?: string | null
  createdBy?: number | string | null
  items: PurchaseItemResponse[]
}
