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
