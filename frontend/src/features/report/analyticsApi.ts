import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface DailyTrendPoint {
  date: string
  totalSales: number
  posSales: number
  onlineSales: number
  orderCount: number
}

export interface ProductSaleLine {
  vegetableId: number
  name: string
  quantity: number
  revenue: number
}

export interface ZeroSaleProduct {
  vegetableId: number
  name: string
  currentStock: number
}

export interface PaymentMethodBreakdown {
  channel: string
  label: string
  count: number
  amount: number
}

export interface BusinessAnalyticsReport {
  from: string
  to: string
  totalSales: number
  totalOrders: number
  posBills: number
  onlineValidOrders: number
  averageOrderValue: number
  totalItemsSold: number
  cashCollections: number
  upiDigitalCollections: number
  codCollected: number
  codSettledToShop: number
  codPendingSettlement: number
  totalRefunds: number
  cashRefunds: number
  digitalRefunds: number
  cancelledOrders: number
  deliveredOrders: number
  pendingOrders: number
  completedOrders: number
  averageDailySales: number
  highestSalesDay: DailyTrendPoint | null
  dailyTrend: DailyTrendPoint[]
  paymentBreakdown: PaymentMethodBreakdown[]
  topProducts: ProductSaleLine[]
  bestSellingProduct: ProductSaleLine | null
  zeroSaleProducts: ZeroSaleProduct[]
  lowStockCount: number
  outOfStockCount: number
  totalActiveProducts: number
  purchaseSpend: number
  loyaltyPointsIssued?: number
  loyaltyPointsRedeemed?: number
  loyaltyOutstandingLiability?: number
  loyaltyRedemptionOrders?: number
}

export const analyticsKeys = {
  report: (from: string, to: string) => ['owner', 'analytics', from, to] as const,
}

export const analyticsApi = {
  getAnalytics: (from: string, to: string) =>
    api.get<BusinessAnalyticsReport>(
      `/api/reports/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
}

export function useBusinessAnalytics(from: string, to: string) {
  return useQuery({
    queryKey: analyticsKeys.report(from, to),
    queryFn: () => analyticsApi.getAnalytics(from, to),
    enabled: Boolean(from && to),
  })
}
