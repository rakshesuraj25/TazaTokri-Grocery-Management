export type SupplierType = 'FARMER' | 'WHOLESALE_MARKET' | 'OTHER'
export type PurchaseStatus = 'COMPLETED' | 'CANCELLED'
export type PurchasePaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED'
export type SupplierPaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER'

export interface Supplier {
  id: number | string
  name: string
  type: SupplierType
  phone?: string | null
  address?: string | null
  notes?: string | null
  active: boolean
  createdAt?: string | null
}

export interface SupplierSummary {
  id: number | string
  name: string
  type: SupplierType
  phone?: string | null
  address?: string | null
  notes?: string | null
  active: boolean
  createdAt?: string | null
  purchaseCount: number
  totalPurchases: string | number
  totalPayments: string | number
  outstandingPayable: string | number
  lastPurchaseDate?: string | null
}

export interface SupplierDashboardResponse {
  totalSuppliers: number
  activeSuppliers: number
  totalPurchases: string | number
  totalPayments: string | number
  totalOutstandingPayable: string | number
  suppliers: SupplierSummary[]
}

export interface SupplierPayment {
  id: number | string
  supplierId: number | string
  supplierName: string
  purchaseId?: number | string | null
  invoiceNumber?: string | null
  amount: string | number
  paymentMethod: SupplierPaymentMethod
  paymentDate: string
  referenceNumber?: string | null
  notes?: string | null
  recordedBy?: number | string | null
  createdAt?: string | null
}

export interface SupplierDetailResponse {
  summary: SupplierSummary
  purchases: PurchaseResponse[]
  payments: SupplierPayment[]
}

export interface CreateSupplierRequest {
  name: string
  type: SupplierType
  phone?: string
  address?: string
  notes?: string
  active?: boolean
}

export interface RecordSupplierPaymentRequest {
  purchaseId?: number | null
  amount: string
  paymentMethod: SupplierPaymentMethod
  paymentDate: string
  referenceNumber?: string
  idempotencyKey?: string
  notes?: string
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
  invoiceNumber?: string
  idempotencyKey?: string
  note?: string
  items: CreatePurchaseItemInput[]
}

export interface PurchaseItemResponse {
  vegetableId: number | string
  vegetableName: string
  unit?: string | null
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
  invoiceNumber?: string | null
  status?: PurchaseStatus
  transportCost: string | number
  totalCost: string | number
  paidAmount?: string | number
  outstandingAmount?: string | number
  paymentStatus?: PurchasePaymentStatus
  note?: string | null
  cancelledAt?: string | null
  cancelReason?: string | null
  createdBy?: number | string | null
  createdAt?: string | null
  items: PurchaseItemResponse[]
}
