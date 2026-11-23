import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, RefreshCw, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { toApiError } from '@/lib/api'
import { dec, formatMoney, sumMoney } from '@/lib/money'
import { useMyDeliveryOrders, useStartDelivery } from '../hooks'
import type { DeliveryOrder } from '../types'
import { DeliverOrderDialog, FailOrderDialog } from '../components/DeliveryModals'
import { DeliveryOrderCard } from '../components/DeliveryOrderCard'

export default function DeliveryOrdersPage() {
  const { t } = useTranslation()
  const orders = useMyDeliveryOrders()
  const startDelivery = useStartDelivery()

  const [deliverTarget, setDeliverTarget] = useState<DeliveryOrder | null>(null)
  const [failTarget, setFailTarget] = useState<DeliveryOrder | null>(null)
  const touchStartY = useRef<number | null>(null)

  if (orders.isPending || orders.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-44 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (orders.isError) {
    return <ErrorState onRetry={() => void orders.refetch()} />
  }

  const list = orders.data ?? []
  const assignedCount = list.filter((o) => o.deliveryStatus === 'ASSIGNED').length
  const outCount = list.filter((o) => o.deliveryStatus === 'OUT_FOR_DELIVERY').length
  const doneCount = list.filter((o) => o.deliveryStatus === 'DELIVERED').length
  const cashToCollect = sumMoney(
    list
      .filter(
        (o) =>
          (o.deliveryStatus === 'ASSIGNED' || o.deliveryStatus === 'OUT_FOR_DELIVERY') &&
          dec(o.amountToCollect).gt(0),
      )
      .map((o) => o.amountToCollect),
  )

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 2) {
      touchStartY.current = e.touches[0]?.clientY ?? null
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartY.current
    touchStartY.current = null
    if (start === null) return
    const end = e.changedTouches[0]?.clientY ?? start
    if (end - start > 75 && window.scrollY <= 2) {
      void orders.refetch()
    }
  }

  return (
    <div
      className="space-y-4"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <PageHeader
        title={t('delivery.title')}
        subtitle={t('delivery.pullToRefreshHint', {
          defaultValue: 'Pull down or tap refresh for new drops',
        })}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void orders.refetch()}
            disabled={orders.isFetching}
            className="rounded-full"
          >
            <RefreshCw className={`size-4 ${orders.isFetching ? 'animate-spin' : ''}`} />
            {t('common.retry', { defaultValue: 'Refresh' })}
          </Button>
        }
      />

      {/* Day summary strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label={t('delivery.summaryAssigned', { defaultValue: 'Assigned' })} value={assignedCount} />
        <Stat label={t('delivery.summaryActive', { defaultValue: 'Out now' })} value={outCount} />
        <Stat label={t('delivery.summaryDone', { defaultValue: 'Done' })} value={doneCount} />
        <Stat
          label={t('delivery.summaryCollect', { defaultValue: 'To collect' })}
          value={formatMoney(cashToCollect)}
          tone="warning"
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-10" aria-hidden />}
          title={t('delivery.noOrders')}
          actionLabel={t('delivery.refresh', { defaultValue: 'Refresh deliveries' })}
          onAction={() => void orders.refetch()}
        />
      ) : assignedCount === 0 && outCount === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="text-primary size-10" aria-hidden />}
          title={t('delivery.allCaughtUp', { defaultValue: 'All assigned deliveries finished!' })}
          description={t('delivery.allCaughtUpHint', {
            defaultValue: 'Refresh later to check if more orders are assigned.',
          })}
        />
      ) : null}

      {list.map((order) => (
        <DeliveryOrderCard
          key={String(order.orderId)}
          order={order}
          startPending={startDelivery.isPending}
          onStart={(id) =>
            startDelivery.mutate(id, {
              onError: (err) => toast.error(toApiError(err).message),
            })
          }
          onDeliver={setDeliverTarget}
          onFail={setFailTarget}
        />
      ))}

      <DeliverOrderDialog order={deliverTarget} onClose={() => setDeliverTarget(null)} />
      <FailOrderDialog order={failTarget} onClose={() => setFailTarget(null)} />
    </div>
  )
}
