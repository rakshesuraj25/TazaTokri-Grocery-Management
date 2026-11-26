import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, MapPin, Phone, RefreshCw, Truck, WifiOff } from 'lucide-react'
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
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

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

  const activeOrder = list.find((o) => o.deliveryStatus === 'OUT_FOR_DELIVERY') ?? null
  const activePhone = (activeOrder?.customerPhone ?? '').replace(/[^\d+]/g, '')
  const activeMapsUrl = activeOrder
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        [activeOrder.address, activeOrder.pincode].filter(Boolean).join(', '),
      )}`
    : ''

  return (
    <div
      className={`space-y-4 ${activeOrder ? 'pb-24 sm:pb-4' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {!isOnline && (
        <div
          role="alert"
          className="bg-destructive/10 border-destructive/30 text-destructive flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden />
          <span>
            {t('delivery.offlineNotice', {
              defaultValue: 'You are offline. Status updates are paused until connection returns.',
            })}
          </span>
        </div>
      )}
      {orders.isStale && isOnline && orders.dataUpdatedAt > 0 && (
        <div className="bg-secondary/70 border-border text-muted-foreground flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs">
          <span>
            {t('delivery.lastSynced', {
              time: new Date(orders.dataUpdatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              defaultValue: `Last synced at ${new Date(orders.dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            })}
          </span>
          <button
            type="button"
            onClick={() => void orders.refetch()}
            className="text-primary font-semibold underline-offset-2 hover:underline"
          >
            {t('common.refresh', { defaultValue: 'Refresh' })}
          </button>
        </div>
      )}
      <PageHeader
        serif
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
          disabledOffline={!isOnline}
          onStart={(id) =>
            startDelivery.mutate(id, {
              onError: (err) => toast.error(toApiError(err).message),
            })
          }
          onDeliver={setDeliverTarget}
          onFail={setFailTarget}
        />
      ))}

      {activeOrder && (
        <div
          data-testid="delivery-active-thumb-bar"
          className="bg-card/95 border-border fixed inset-x-0 bottom-0 z-30 border-t px-3.5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden"
        >
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            {activePhone && (
              <Button asChild variant="outline" size="lg" className="min-h-12 rounded-xl px-3">
                <a href={`tel:${activePhone}`} aria-label={t('delivery.callCustomer')}>
                  <Phone className="size-4" />
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="min-h-12 rounded-xl px-3">
              <a
                href={activeMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('delivery.openMaps')}
              >
                <MapPin className="size-4" />
              </a>
            </Button>
            <Button
              size="lg"
              disabled={!isOnline}
              onClick={() => setDeliverTarget(activeOrder)}
              className="min-h-12 flex-1 rounded-xl font-semibold"
            >
              <CheckCircle2 className="size-4" />
              #{activeOrder.orderId} · {t('delivery.deliver')}
            </Button>
          </div>
        </div>
      )}

      <DeliverOrderDialog order={deliverTarget} onClose={() => setDeliverTarget(null)} />
      <FailOrderDialog order={failTarget} onClose={() => setFailTarget(null)} />
    </div>
  )
}
