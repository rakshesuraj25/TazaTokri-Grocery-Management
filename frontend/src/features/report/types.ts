import type { BaseUnit } from '@/features/catalog/types'

export interface DailyPaymentSplit {
  method: string
  bills: number
  total: string | number
}

export interface DailyTopItem {
  vegetableId: number | string
  name: string
  quantity: string | number
  revenue: string | number
}

export interface DailyQuantityItem {
  vegetableId: number | string
  name: string
  quantity: string | number
}

/**
 * Daily owner report.
 * IMPORTANT: `purchaseSpend` is total purchase spend today, NOT profit.
 * Label it "Purchases today", never "profit".
 */
export interface DailyReportResponse {
  date: string
  totalSales: string | number
  totalBills: number
  averageBill: string | number
  byPayment: DailyPaymentSplit[]
  topItems: DailyTopItem[]
  purchaseSpend: string | number
  wastage: DailyQuantityItem[]
  stock: DailyQuantityItem[]
}

export interface WastageReasonLine {
  reason: string
  entries: number
  totalQuantity: string | number
  estimatedLoss: string | number
}

export interface WastageVegetableLine {
  vegetableId: number | string
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  baseUnit: BaseUnit
  quantity: string | number
  avgPurchaseCostPerUnit: string | number | null
  estimatedLoss: string | number | null
}

export interface WastagePeriodSummary {
  totalEntries: number
  totalEstimatedLoss: string | number
  byReason: WastageReasonLine[]
  byVegetable: WastageVegetableLine[]
}

export interface WastageEntryLine {
  id: number | string
  vegetableId: number | string
  vegetableName: string
  baseUnit: BaseUnit
  quantity: string | number
  reason: string
  note?: string | null
  createdBy?: number | string | null
  createdByName?: string | null
  createdAt: string
  unitPurchaseCost: string | number | null
  estimatedLoss: string | number | null
}

export interface WastageReportResponse {
  date: string
  weekStart: string
  daily: WastagePeriodSummary
  weekly: WastagePeriodSummary
  entries: WastageEntryLine[]
}

export interface ValuationLineDto {
  vegetableId: number | string
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  baseUnit: BaseUnit
  currentStock: string | number
  unitLandedCost: string | number | null
  estimatedValue: string | number | null
}

export interface InventoryValuationDto {
  totalEstimatedValue: string | number
  costedVegetablesCount: number
  uncostedVegetablesCount: number
  items: ValuationLineDto[]
}

export interface StockMovementLineDto {
  vegetableId: number | string
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  baseUnit: BaseUnit
  openingStock: string | number
  purchasesQty: string | number
  onlineSalesNetQty: string | number
  quickSalesQty: string | number
  wastageQty: string | number
  adjustmentsQty: string | number
  closingStock: string | number
}

export interface PaymentMethodLineDto {
  channel: 'COUNTER' | 'ONLINE' | string
  method: string
  transactions: number
  amount: string | number
}

export interface BestSellerLineDto {
  vegetableId: number | string
  nameEn: string
  baseUnit: BaseUnit
  totalQtySold: string | number
  totalRevenue: string | number
}

export interface SalesPerformanceDto {
  todayRevenue: string | number
  weekRevenue: string | number
  monthRevenue: string | number
  periodTotalRevenue: string | number
  periodTotalTransactions: number
  averageTransactionValue: string | number
  counterSalesRevenue: string | number
  counterSalesCount: number
  onlineOrdersRevenue: string | number
  onlineOrdersCount: number
  paymentBreakdown: PaymentMethodLineDto[]
  bestSellingVegetables: BestSellerLineDto[]
}

export interface ProfitabilitySummaryDto {
  merchandiseRevenue: string | number
  deliveryFeesCollected: string | number
  costedMerchandiseRevenue: string | number
  estimatedCogs: string | number
  estimatedGrossProfit: string | number
  grossMarginPercent: string | number
  wastageCost: string | number
  estimatedNetContribution: string | number
  uncostedSoldItemsCount: number
  isEstimate: boolean
}

export interface PurchaseBatchLineDto {
  purchaseItemId: number | string
  purchaseId: number | string
  purchaseDate: string
  daysSincePurchase: number
  supplierName: string
  vegetableId: number | string
  vegetableName: string
  baseUnit: BaseUnit
  receivedQuantity: string | number
  estimatedRemainingQuantity: string | number
  landedCostPerUnit: string | number
  currentSellingPrice: string | number | null
}

export interface BusinessIntelligenceReportResponse {
  fromDate: string
  toDate: string
  inventoryValuation: InventoryValuationDto
  stockMovements: StockMovementLineDto[]
  salesPerformance: SalesPerformanceDto
  profitability: ProfitabilitySummaryDto
  freshnessBatches: PurchaseBatchLineDto[]
}

export interface OperationalHealthResponse {
  status: 'UP' | 'DEGRADED' | string
  databaseConnected: boolean
  applicationVersion: string
  environment: string
  timestampIst: string
  providers: {
    whatsappCloudConfigured: boolean
    geminiAiConfigured: boolean
    razorpayConfigured: boolean
    sentryConfigured: boolean
    proofStorageProvider: string
  }
  lastBackup: {
    available: boolean
    status: string
    lastBackupAt: string | null
    backupFileName: string | null
    fileSizeBytes?: number
    sha256Checksum?: string | null
  }
}
