import type { TFunction } from 'i18next'
import type { StaffCatalogItem } from '@/features/catalog/types'
import type { OrderResponse } from '@/features/orders/types'
import { isLowStock } from '@/lib/businessRules'
import { dec, formatMoney, sumMoney } from '@/lib/money'
import type { AttentionItem } from './components/NeedsAttentionCard'

export interface DashboardAttentionInput {
  catalog: StaffCatalogItem[]
  orders: OrderResponse[]
  cashHeldAmounts: Array<string | number>
  missingPhotosCount: number
  totalPhotoTargets: number
  t: TFunction
}

/**
 * Pure derivation of the Owner "Needs attention" queue from live server payloads only.
 */
export function buildDashboardAttentionItems({
  catalog,
  orders,
  cashHeldAmounts,
  missingPhotosCount,
  totalPhotoTargets,
  t,
}: DashboardAttentionInput): AttentionItem[] {
  const items: AttentionItem[] = []

  const outOfStockCount = catalog.filter((v) => dec(v.stock).lte(0)).length
  const lowStockCount = catalog.filter((v) => isLowStock(v.stock, v.baseUnit)).length
  const outOrLowCount = outOfStockCount + lowStockCount
  if (outOrLowCount > 0) {
    items.push({
      id: 'stock',
      label: t('staff.dashboard.attentionOutLowStock', {
        defaultValue: 'Out or low stock vegetables',
      }),
      countLabel: `${outOrLowCount}`,
      to: '/staff/stock',
      tone: 'warning',
    })
  }

  const unpricedCount = catalog.filter((v) => v.pricePerUnit === null).length
  if (unpricedCount > 0) {
    items.push({
      id: 'pricing',
      label: t('staff.dashboard.attentionUnpriced', {
        defaultValue: 'Unpriced vegetables',
      }),
      countLabel: `${unpricedCount}`,
      to: '/staff/pricing',
      tone: 'destructive',
    })
  }

  const ordersWaitingCount = orders.filter(
    (o) => o.status === 'PLACED' || o.status === 'CONFIRMED' || o.status === 'PACKED',
  ).length
  if (ordersWaitingCount > 0) {
    items.push({
      id: 'orders',
      label: t('staff.dashboard.attentionOrdersWaiting', {
        defaultValue: 'Orders waiting confirm / pack / dispatch',
      }),
      countLabel: `${ordersWaitingCount}`,
      to: '/staff/orders',
      tone: 'secondary',
    })
  }

  const cashHeldTotal = sumMoney(cashHeldAmounts)
  if (cashHeldTotal.gt(0)) {
    items.push({
      id: 'cash',
      label: t('staff.dashboard.attentionCashHeld', {
        defaultValue: 'COD cash held by delivery team',
      }),
      countLabel: formatMoney(cashHeldTotal),
      to: '/staff/payments',
      tone: 'warning',
    })
  }

  const cancelledOnlineCount = orders.filter(
    (o) => o.status === 'CANCELLED' && o.paymentMethod === 'ONLINE',
  ).length
  if (cancelledOnlineCount > 0) {
    items.push({
      id: 'refunds',
      label: t('staff.dashboard.attentionPendingRefunds', {
        defaultValue: 'Review cash settlements & refunds',
      }),
      countLabel: `${cancelledOnlineCount}`,
      to: '/staff/payments',
      tone: 'warning',
    })
  }

  if (missingPhotosCount > 0) {
    items.push({
      id: 'images',
      label: t('staff.dashboard.missingPhotosAttention', {
        defaultValue: 'Missing vegetable photos — see docs/IMAGES.md & Image Review',
      }),
      countLabel: `${missingPhotosCount}/${totalPhotoTargets}`,
      to: '/staff/catalog/images',
      tone: 'secondary',
    })
  }

  return items
}
