import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Package, ShoppingBag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EstimatedAmount, MoneyDisplay } from '@/components/MoneyDisplay'
import { StatusBadge } from '@/components/StatusBadge'
import type { OrderResponse } from '@/features/orders/types'
import type { PurchaseResponse } from '@/features/purchase/types'
import { fmtDate } from '@/lib/dates'

interface DashboardRecentActivityProps {
  orders: OrderResponse[]
  purchases: PurchaseResponse[]
}

export function DashboardRecentActivity({ orders, purchases }: DashboardRecentActivityProps) {
  const { t } = useTranslation()

  const recentOrders = orders.slice(0, 4)
  const recentPurchases = purchases.slice(0, 4)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Package className="text-primary size-4" aria-hidden />
            {t('staff.dashboard.recentOrders', { defaultValue: 'Recent orders' })}
          </CardTitle>
          <Link
            to="/staff/orders"
            className="text-primary inline-flex items-center gap-1 text-xs font-bold hover:underline"
          >
            {t('common.viewAll', { defaultValue: 'View all' })}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">{t('orders.noOrders')}</p>
          ) : (
            <ul className="divide-border divide-y">
              {recentOrders.map((order) => (
                <li
                  key={String(order.id)}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-extrabold">#{order.id}</span>
                      <StatusBadge kind="order" status={order.status} />
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {order.deliveryAddress}
                      {order.deliveryPincode ? ` (${order.deliveryPincode})` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {order.finalTotal !== null ? (
                      <MoneyDisplay
                        value={order.finalTotal}
                        className="font-display text-primary text-sm font-extrabold"
                      />
                    ) : (
                      <EstimatedAmount
                        value={order.estimatedTotal}
                        className="font-display text-primary text-sm font-extrabold"
                      />
                    )}
                    <p className="text-muted-foreground text-[11px]">{order.paymentMethod}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <ShoppingBag className="text-primary size-4" aria-hidden />
            {t('staff.dashboard.recentPurchases', { defaultValue: 'Recent purchases' })}
          </CardTitle>
          <Link
            to="/staff/purchases"
            className="text-primary inline-flex items-center gap-1 text-xs font-bold hover:underline"
          >
            {t('common.viewAll', { defaultValue: 'View all' })}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </CardHeader>
        <CardContent>
          {recentPurchases.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">{t('common.noData')}</p>
          ) : (
            <ul className="divide-border divide-y">
              {recentPurchases.map((purchase) => (
                <li key={String(purchase.id)} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    to={`/staff/purchases/${purchase.id}`}
                    className="hover:text-primary flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display truncate text-sm font-bold">
                          {purchase.supplierName}
                        </span>
                        <Badge variant="outline" className="text-[11px]">
                          {fmtDate(purchase.purchaseDate)}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {purchase.items.length} {t('orders.items')}
                      </p>
                    </div>
                    <MoneyDisplay
                      value={purchase.totalCost}
                      className="font-display text-primary shrink-0 text-sm font-extrabold"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
