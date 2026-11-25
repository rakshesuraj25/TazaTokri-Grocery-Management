import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Truck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { useStaffCatalog } from '@/features/catalog/hooks'
import { StaffDeliveryBoardPanel } from '@/features/delivery/components/StaffDeliveryBoardPanel'
import { todayIST } from '@/lib/dates'
import { toApiError } from '@/lib/api'
import { useConfirmOrder, useStaffOrders } from '../hooks'
import type { OrderResponse, OrderStatus } from '../types'
import {
  AssignDeliveryDialog,
  CancelStaffOrderDialog,
  PackOrderDialog,
} from '../components/StaffOrderModals'
import { StaffOrderCard } from '../components/StaffOrderCard'

const STATUS_FILTERS: Array<OrderStatus | 'ALL'> = [
  'ALL',
  'PLACED',
  'CONFIRMED',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]

export default function StaffOrdersPage() {
  const { t } = useTranslation()
  const [date, setDate] = useState<string>(() => todayIST())
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [showDispatchBoard, setShowDispatchBoard] = useState(false)

  const catalog = useStaffCatalog()
  const allDateOrders = useStaffOrders({ date: date || undefined })
  const orders = useStaffOrders({
    date: date || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  })
  const confirmOrder = useConfirmOrder()

  const catalogById = useMemo(
    () => new Map((catalog.data ?? []).map((v) => [String(v.id), v])),
    [catalog.data],
  )

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = orders.data ?? []
    if (!q) return list
    return list.filter(
      (o) =>
        String(o.id).toLowerCase().includes(q) ||
        o.deliveryAddress.toLowerCase().includes(q) ||
        o.deliveryPincode.toLowerCase().includes(q) ||
        o.items.some((item) => item.vegetableName.toLowerCase().includes(q)),
    )
  }, [orders.data, search])

  const statusCounts = new Map<string, number>()
  for (const o of allDateOrders.data ?? []) {
    statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1)
  }

  const [packTarget, setPackTarget] = useState<OrderResponse | null>(null)
  const [assignTarget, setAssignTarget] = useState<OrderResponse | null>(null)
  const [cancelTarget, setCancelTarget] = useState<OrderResponse | null>(null)

  const handleConfirm = (order: OrderResponse) => {
    confirmOrder.mutate(order.id, {
      onSuccess: () => toast.success(t('orders.status.CONFIRMED')),
      onError: (err) => toast.error(toApiError(err).message),
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3.5 py-4 sm:px-6 sm:py-6">
      <PageHeader
        serif
        title={t('staff.orders.title')}
        count={filteredOrders.length}
        breadcrumbs={[
          { label: t('staff.groups.orders') },
          { label: t('staff.orders.title') },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={showDispatchBoard ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowDispatchBoard((v) => !v)}
              className="rounded-full"
            >
              <Truck className="size-4" aria-hidden />
              {t('delivery.dispatchBoardBtn', {
                defaultValue: 'Delivery Dispatch Board',
              })}
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label={t('checkout.deliveryDate')}
              className="w-44"
            />
            {date && (
              <Button variant="ghost" size="sm" onClick={() => setDate('')}>
                {t('common.all')}
              </Button>
            )}
          </div>
        }
      />

      {showDispatchBoard && (
        <StaffDeliveryBoardPanel
          date={date || undefined}
          onRequestAssign={(orderId) => {
            const match = (allDateOrders.data ?? []).find(
              (o) => String(o.id) === String(orderId),
            )
            if (match) {
              setAssignTarget(match)
            }
          }}
        />
      )}

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <Input
          type="search"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('staff.orders.searchPlaceholder', {
            defaultValue: 'Search order #, address, pincode or vegetable',
          })}
          aria-label={t('staff.orders.searchPlaceholder', {
            defaultValue: 'Search order #, address, pincode or vegetable',
          })}
          className="bg-card pr-10 pl-10"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label={t('common.clear', { defaultValue: 'Clear' })}
            className="touch-target text-muted-foreground hover:text-foreground absolute top-1/2 right-1 inline-flex -translate-y-1/2 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((st) => {
          const count =
            st === 'ALL' ? (allDateOrders.data?.length ?? 0) : (statusCounts.get(st) ?? 0)
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`touch-target shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                statusFilter === st
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {st === 'ALL' ? t('common.all') : t(`orders.status.${st}`, { defaultValue: st })}{' '}
              ({count})
            </button>
          )
        })}
      </div>

      {orders.isPending || orders.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState onRetry={() => void orders.refetch()} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title={search ? t('common.noResults') : t('orders.noOrders')}
          action={
            search || statusFilter !== 'ALL' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('ALL')
                }}
              >
                {t('common.resetFilters', { defaultValue: 'Clear filters' })}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <StaffOrderCard
              key={String(order.id)}
              order={order}
              catalogById={catalogById}
              confirmPending={confirmOrder.isPending}
              onConfirm={handleConfirm}
              onPack={setPackTarget}
              onAssign={setAssignTarget}
              onCancel={setCancelTarget}
            />
          ))}
        </div>
      )}

      <PackOrderDialog order={packTarget} onClose={() => setPackTarget(null)} />
      <AssignDeliveryDialog order={assignTarget} onClose={() => setAssignTarget(null)} />
      <CancelStaffOrderDialog order={cancelTarget} onClose={() => setCancelTarget(null)} />
    </div>
  )
}
