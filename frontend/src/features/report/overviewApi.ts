import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface KpiOverview {
  date: string
  todaySales: string | number
  yesterdaySales: string | number
  salesChangeAmount: string | number
  salesChangePercent: string | number | null
  todayOrders: number
  pendingOrders: number
  completedOrders: number
  cancelledOrders: number
  averageOrderValue: string | number
}

export interface OrderStatusOverview {
  pendingConfirmation: number
  confirmed: number
  preparing: number
  outForDelivery: number
  delivered: number
  cancelled: number
}

export interface InventoryAlertItem {
  vegetableId: number
  name: string
  unit: string
  currentStock: string | number
  alertType: 'OUT_OF_STOCK' | 'CRITICAL_RISK' | 'HIGH_RISK' | 'LOW_STOCK'
  daysRemaining: string | number | null
  suggestedPurchaseQty: string | number
}

export interface TopSellingProduct {
  vegetableId: number
  name: string
  unit: string
  quantitySold: string | number
  revenue: string | number
}

export interface FinancialOverview {
  todayCashSales: string | number
  todayDigitalSales: string | number
  codCollected: string | number
  codSettledToShop: string | number
  codPendingSettlement: string | number
  supplierOutstandingPayable: string | number
}

export interface RecentActivityItem {
  type: 'ORDER' | 'PURCHASE' | 'STOCK' | 'SUPPLIER_PAYMENT'
  title: string
  subtitle: string
  amount: string | number | null
  timestamp: string
  link: string
}

export interface BusinessOverviewResponse {
  kpis: KpiOverview
  orderStatus: OrderStatusOverview
  inventoryAlerts: InventoryAlertItem[]
  topSellingToday: TopSellingProduct[]
  financials: FinancialOverview
  recentActivity: RecentActivityItem[]
}

export const reportOverviewApi = {
  getOverview: () => api.get<BusinessOverviewResponse>('/api/reports/overview'),
}

export function useBusinessOverview() {
  return useQuery({
    queryKey: ['report', 'overview'],
    queryFn: () => reportOverviewApi.getOverview(),
  })
}
