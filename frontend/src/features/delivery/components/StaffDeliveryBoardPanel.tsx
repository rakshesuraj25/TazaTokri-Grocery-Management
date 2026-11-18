import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Camera,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toApiError } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { useReturnDeliveryToStore, useStaffDeliveryBoard } from '../hooks'

interface StaffDeliveryBoardPanelProps {
  date?: string
  onRequestAssign: (orderId: number | string) => void
}

const STAGES = [
  'ALL',
  'READY_FOR_DELIVERY',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED_TO_STORE',
  'CANCELLED',
] as const

export function StaffDeliveryBoardPanel({
  date,
  onRequestAssign,
}: StaffDeliveryBoardPanelProps) {
  const { t } = useTranslation()
  const [stage, setStage] = useState<string>('ALL')
  const [pincode, setPincode] = useState<string>('')
  const [assigneeId, setAssigneeId] = useState<string>('')

  const boardQuery = useStaffDeliveryBoard({
    date,
    stage: stage === 'ALL' ? undefined : stage,
    pincode: pincode || undefined,
    deliveryUserId:
      assigneeId && assigneeId !== 'UNASSIGNED' ? assigneeId : undefined,
  })
  const returnToStore = useReturnDeliveryToStore()

  const board = boardQuery.data

  const handleReturnToStore = (orderId: number | string) => {
    returnToStore.mutate(
      { orderId, note: 'Failed delivery package returned to store' },
      {
        onSuccess: () =>
          toast.success(
            t('delivery.returnedToStoreToast', {
              defaultValue: 'Delivery marked as returned to store.',
            }),
          ),
        onError: (err) => toast.error(toApiError(err).message),
      },
    )
  }

  return (
    <Card
      data-testid="staff-delivery-board-panel"
      className="border-border bg-card space-y-4 rounded-2xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display flex items-center gap-2 text-base font-bold">
            <Truck className="text-primary size-5" aria-hidden />
            {t('delivery.dispatchBoardTitle', {
              defaultValue: 'Delivery Dispatch & Area Grouping Board',
            })}
          </h2>
          <p className="text-muted-foreground text-xs">
            {t('delivery.dispatchBoardSubtitle', {
              defaultValue:
                'Group nearby deliveries by PIN code, locality, or assigned delivery person and track OTP / photo proof.',
            })}
          </p>
        </div>

        {(pincode || assigneeId || stage !== 'ALL') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStage('ALL')
              setPincode('')
              setAssigneeId('')
            }}
            className="text-xs"
          >
            {t('common.resetFilters', { defaultValue: 'Reset filters' })}
          </Button>
        )}
      </div>

      {/* Stage Filter Strip */}
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStage(st)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              stage === st
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-subtle text-muted-foreground hover:text-foreground'
            }`}
          >
            {st === 'ALL'
              ? t('common.all')
              : t(`delivery.stage.${st}`, { defaultValue: st.replaceAll('_', ' ') })}
          </button>
        ))}
      </div>

      {/* Task 1E: Basic Delivery Grouping by PIN Code, Locality & Assigned Person */}
      {board && (board.byPincode.length > 0 || board.byAssignee.length > 0) && (
        <div className="bg-surface-subtle grid gap-2.5 rounded-xl p-3 text-xs sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground mb-1 block text-[11px] font-semibold">
              {t('delivery.groupByPincode', { defaultValue: 'Group by PIN Code' })}
            </span>
            <div className="flex flex-wrap gap-1">
              {board.byPincode.map((g) => (
                <button
                  key={g.groupKey}
                  type="button"
                  onClick={() =>
                    setPincode(pincode === g.groupKey ? '' : g.groupKey)
                  }
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    pincode === g.groupKey
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-card'
                  }`}
                >
                  {g.label} ({g.orderCount})
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-muted-foreground mb-1 block text-[11px] font-semibold">
              {t('delivery.groupByLocality', { defaultValue: 'Nearby Localities' })}
            </span>
            <div className="flex flex-wrap gap-1">
              {board.byLocality.map((g) => (
                <span
                  key={g.groupKey}
                  className="bg-card rounded-md border px-2 py-0.5 text-[11px]"
                >
                  {g.label} ({g.orderCount})
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-muted-foreground mb-1 block text-[11px] font-semibold">
              {t('delivery.groupByPerson', {
                defaultValue: 'By Delivery Person',
              })}
            </span>
            <div className="flex flex-wrap gap-1">
              {board.byAssignee.map((g) => (
                <button
                  key={g.groupKey}
                  type="button"
                  onClick={() =>
                    setAssigneeId(assigneeId === g.groupKey ? '' : g.groupKey)
                  }
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    assigneeId === g.groupKey
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-card'
                  }`}
                >
                  {g.label} ({g.orderCount})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delivery Orders Table / Cards */}
      {board && board.orders.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-xs">
          {t('delivery.noBoardOrders', {
            defaultValue: 'No delivery orders match the selected filters.',
          })}
        </p>
      ) : (
        <div className="space-y-2.5">
          {(board?.orders ?? []).map((item) => {
            const canAssignOrReassign =
              item.orderStatus === 'PACKED' || item.orderStatus === 'OUT_FOR_DELIVERY'
            const canReturnToStore = item.attemptStatus === 'FAILED'
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${item.deliveryAddress} ${item.deliveryPincode}`,
            )}`

            return (
              <div
                key={String(item.orderId)}
                className="border-border bg-card flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-display text-sm font-extrabold">
                      #{item.orderId}
                    </span>
                    <Badge variant="outline">{item.deliveryStage}</Badge>
                    <Badge
                      variant={item.paymentStatus === 'PAID' ? 'success' : 'warning'}
                    >
                      {item.paymentMethod} • {item.paymentStatus}
                    </Badge>
                    {item.otpVerified && (
                      <Badge variant="success" className="gap-1">
                        <ShieldCheck className="size-3" aria-hidden />
                        {item.otpVerificationMethod === 'MANUAL_OVERRIDE'
                          ? 'Manual Override'
                          : 'OTP Verified'}
                      </Badge>
                    )}
                    {item.hasProofPhoto && (
                      <Badge variant="secondary" className="gap-1">
                        <Camera className="size-3" aria-hidden />
                        POD Photo
                      </Badge>
                    )}
                  </div>

                  <p className="font-semibold">
                    {item.customerName}{' '}
                    {item.customerPhone && (
                      <a
                        href={`tel:${item.customerPhone}`}
                        className="text-primary ml-1.5 inline-flex items-center gap-0.5 font-normal underline"
                      >
                        <Phone className="size-3" aria-hidden />
                        {item.customerPhone}
                      </a>
                    )}
                  </p>

                  <p className="text-muted-foreground">
                    {item.deliveryAddress} ({item.deliveryPincode} • {item.locality}){' '}
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary ml-1 inline-flex items-center gap-0.5 underline"
                    >
                      <MapPin className="size-3" aria-hidden />
                      Map
                    </a>
                  </p>

                  {item.deliveryInstructions && (
                    <p className="text-foreground font-medium">
                      Note: {item.deliveryInstructions}
                    </p>
                  )}
                  {item.failureReason && (
                    <p className="text-destructive font-medium">
                      Reason: {item.failureReason}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <span className="font-display text-sm font-extrabold">
                      {formatMoney(item.orderAmount)}
                    </span>
                    <span className="text-muted-foreground block text-[11px]">
                      {item.assignedDeliveryUserName
                        ? `Assigned: ${item.assignedDeliveryUserName}`
                        : 'Unassigned'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {canAssignOrReassign && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full px-2.5 text-xs"
                        onClick={() => onRequestAssign(item.orderId)}
                      >
                        <UserCheck className="size-3.5" aria-hidden />
                        {item.assignedDeliveryUserId
                          ? t('delivery.reassignBtn', { defaultValue: 'Reassign' })
                          : t('staff.orders.assign')}
                      </Button>
                    )}

                    {canReturnToStore && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 rounded-full px-2.5 text-xs"
                        loading={returnToStore.isPending}
                        onClick={() => handleReturnToStore(item.orderId)}
                      >
                        <RotateCcw className="size-3.5" aria-hidden />
                        {t('delivery.returnToStoreBtn', {
                          defaultValue: 'Return to Store',
                        })}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
