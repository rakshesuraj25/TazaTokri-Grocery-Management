import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type StockoutRisk = 'CRITICAL' | 'HIGH' | 'LOW' | 'NO_DATA'
export type SalesTrend = 'INCREASING' | 'STABLE' | 'DECREASING' | 'NO_DATA'
export type DemandCategory =
  | 'SELLING_WELL'
  | 'INCREASING_DEMAND'
  | 'DECREASING_DEMAND'
  | 'SLOW_MOVING'
  | 'NO_SALES_HISTORY'
  | 'INSUFFICIENT_DATA'
export type PurchaseAction =
  | 'BUY_TODAY'
  | 'PURCHASE_SOON'
  | 'STOCK_SUFFICIENT'
  | 'REDUCE_PURCHASE'
  | 'NO_DATA'
export type PlanningHorizon = 3 | 7 | 14

export interface ProductDemandInsight {
  vegetableId: number
  name: string
  unit: string
  currentStock: string | number
  totalQtySold30d: string | number
  totalQtySold7d: string | number
  orderCount30d: number
  avgDailyDemand: string | number
  avgDailyLast7d: string | number
  avgDailyLast30d: string | number
  salesTrend: SalesTrend
  daysRemaining: string | number | null
  stockoutRisk: StockoutRisk
  demandCategory?: DemandCategory
  purchaseAction?: PurchaseAction
  lowStock?: boolean
  wastageRisk?: boolean
  forecastDemand: string | number
  suggestedPurchaseQty: string | number
  recommendationReason: string
  avgLandedCost: string | number | null
  estimatedStockValue: string | number | null
}

export interface InventoryInsightsDashboard {
  planningHorizonDays: number
  totalActiveProducts: number
  activelySellingCount: number
  atRiskCount: number
  criticalRiskCount: number
  highRiskCount: number
  lowDemandCount: number
  noSalesHistoryCount?: number
  totalInventoryByUnit: Record<string, string | number>
  estimatedInventoryValue: string | number | null
  valuedProductsCount: number
  uncostedProductsCount: number
  bestSelling: ProductDemandInsight[]
  slowMoving: ProductDemandInsight[]
  wastageRiskProducts?: ProductDemandInsight[]
  increasingDemand: ProductDemandInsight[]
  decreasingDemand: ProductDemandInsight[]
  products: ProductDemandInsight[]
}

export const inventoryInsightsApi = {
  getDashboard: (horizonDays: PlanningHorizon = 7) =>
    api.get<InventoryInsightsDashboard>(`/api/inventory/insights?horizonDays=${horizonDays}`),
  getProductInsight: (vegetableId: number | string, horizonDays: PlanningHorizon = 7) =>
    api.get<ProductDemandInsight>(
      `/api/inventory/insights/${vegetableId}?horizonDays=${horizonDays}`,
    ),
}

export function useInventoryInsights(horizonDays: PlanningHorizon) {
  return useQuery({
    queryKey: ['inventory', 'insights', horizonDays],
    queryFn: () => inventoryInsightsApi.getDashboard(horizonDays),
  })
}
