import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Package, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { EstimatedAmount, MoneyDisplay } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { ListSkeleton } from '@/components/Skeletons'
import { StatusBadge } from '@/components/StatusBadge'
import { useCartStore } from '@/features/cart/store'
import { usePublicVegetables } from '@/features/catalog/hooks'
import { fmtDate } from '@/lib/dates'
import { OrderStatusStepper } from '../components/OrderStatusStepper'
import { useCustomerOrders } from '../hooks'
import { mapOrderItemsToCart } from '../orderAgain'
import type { OrderResponse } from '../types'

type OrderFilterTab = 'ALL' | 'ACTIVE' | 'DELIVERED' | 'CANCELLED'

const ACTIVE_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PLACED',
  'CONFIRMED',
  'PACKED',
  'OUT_FOR_DELIVERY',
])

export default function CustomerOrdersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState<OrderFilterTab>('ALL')
  const orders = useCustomerOrders(page)
  const catalog = usePublicVegetables()
  const addItem = useCartStore((s) => s.addItem)

  const list = useMemo(() => orders.data ?? [], [orders.data])

  const filtered = useMemo(() => {
    if (tab === 'ALL') return list
    if (tab === 'ACTIVE') return list.filter((o) => ACTIVE_STATUSES.has(o.status))
    if (tab === 'DELIVERED') return list.filter((o) => o.status === 'DELIVERED')
    return list.filter((o) => o.status === 'CANCELLED')
  }, [list, tab])

  const handleOrderAgain = (order: OrderResponse) => {
    if (!catalog.data) return
    const { matched, skipped } = mapOrderItemsToCart(order.items, catalog.data)
    for (const item of matched) addItem(item)
    if (skipped.length > 0) {
      toast.info(
        t('orders.orderAgainPartial', {
          items: skipped.join(', '),
          defaultValue: `Added ${matched.length} item(s). Skipped unavailable: ${skipped.join(', ')}`,
        }),
      )
    } else if (matched.length > 0) {
      toast.success(
        t('orders.orderAgainAdded', {
          defaultValue: 'Added items to your cart',
        }),
      )
    }
    if (matched.length > 0) navigate('/shop')
  }

  if (orders.isPending || orders.isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <ListSkeleton rows={4} />
      </div>
    )
  }

  if (orders.isError) {
    return <ErrorState onRetry={() => void orders.refetch()} />
  }

  if (list.length === 0 && page === 0) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <EmptyState
          icon={<Package className="size-8" aria-hidden />}
          title={t('orders.noOrders')}
          description={t('orders.noOrdersHint')}
          actionLabel={t('nav.shop')}
          actionTo="/shop"
        />
      </div>
    )
  }

  const tabs: [OrderFilterTab, string][] = [
    ['ALL', `${t('common.all')} (${list.length})`],
    [
      'ACTIVE',
      `${t('orders.filterActive', { defaultValue: 'Active' })} (${list.filter((o) => ACTIVE_STATUSES.has(o.status)).length})`,
    ],
    [
      'DELIVERED',
      `${t('orders.status.DELIVERED')} (${list.filter((o) => o.status === 'DELIVERED').length})`,
    ],
    [
      'CANCELLED',
      `${t('orders.status.CANCELLED')} (${list.filter((o) => o.status === 'CANCELLED').length})`,
    ],
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 py-4 min-[390px]:px-4 sm:px-6 sm:py-6">
      <PageHeader
        title={t('orders.title')}
        count={list.length}
        serif
        weave
        actions={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/shop">
              {t('nav.shop')}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={tab === key ? 'default' : 'outline'}
            onClick={() => setTab(key)}
            className="rounded-full"
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('common.noResults')}
          actionLabel={t('common.resetFilters', { defaultValue: 'Show all' })}
          onAction={() => setTab('ALL')}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => (
            <Card key={String(order.id)} className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link to={`/shop/orders/${order.id}`} className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-extrabold">#{order.id}</h2>
                    <StatusBadge kind="order" status={order.status} />
                    <Badge variant="outline" className="text-[11px]">
                      {order.paymentMethod}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t('orders.deliveryDate', { date: fmtDate(order.deliveryDate) })}
                    {order.items.length > 0 && ` · ${order.items.length} ${t('orders.items')}`}
                  </p>
                </Link>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right">
                    {order.finalTotal !== null ? (
                      <MoneyDisplay
                        value={order.finalTotal}
                        className="font-display text-primary text-xl font-extrabold"
                      />
                    ) : (
                      <EstimatedAmount
                        value={order.estimatedTotal}
                        className="font-display text-primary text-base font-extrabold"
                      />
                    )}
                  </div>

                  {catalog.data && order.items.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => handleOrderAgain(order)}
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      {t('orders.orderAgain', { defaultValue: 'Order again' })}
                    </Button>
                  )}

                  <Button asChild size="sm" variant="secondary" className="rounded-full">
                    <Link to={`/shop/orders/${order.id}`}>
                      {t('orders.viewDetails', { defaultValue: 'Details' })}
                    </Link>
                  </Button>
                </div>
              </div>

              {ACTIVE_STATUSES.has(order.status) && (
                <div className="border-border/70 border-t pt-3">
                  <OrderStatusStepper status={order.status} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          {t('common.back')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={list.length === 0}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  )
}
