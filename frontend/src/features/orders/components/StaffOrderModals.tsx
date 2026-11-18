import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Truck } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAssignDelivery, useDeliveryPeople, useOrderDeliveries } from '@/features/delivery/hooks'
import { fmtDateTime } from '@/lib/dates'
import { toApiError } from '@/lib/api'
import { useCancelStaffOrder } from '../hooks'
import type { OrderResponse } from '../types'

export { PackOrderDialog } from './PackOrderDialog'

interface AssignDeliveryDialogProps {
  order: OrderResponse | null
  onClose: () => void
}

export function AssignDeliveryDialog({ order, onClose }: AssignDeliveryDialogProps) {
  const { t } = useTranslation()
  const people = useDeliveryPeople()
  const attempts = useOrderDeliveries(order?.id)
  const assign = useAssignDelivery()
  const [selectedPersonId, setSelectedPersonId] = useState<string>('')
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedPersonId('')
    setServerError(null)
  }, [order])

  const handleAssign = () => {
    if (!order || !selectedPersonId) return
    setServerError(null)
    assign.mutate(
      { orderId: order.id, deliveryUserId: selectedPersonId },
      {
        onSuccess: () => {
          toast.success(t('staff.orders.assign'))
          onClose()
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {order && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="text-primary size-5" />
                {t('staff.orders.assign')} — #{order.id}
              </DialogTitle>
            </DialogHeader>

            {serverError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {serverError}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="assign-person">{t('roles.DELIVERY')}</Label>
              <select
                id="assign-person"
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="border-input bg-card flex h-11 w-full rounded-lg border px-3 text-sm"
              >
                <option value="">--</option>
                {(people.data ?? []).map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.fullName} ({p.phone})
                  </option>
                ))}
              </select>
            </div>

            {(attempts.data ?? []).length > 0 && (
              <div className="space-y-1.5 rounded-xl border p-3 text-xs">
                <p className="font-semibold">Previous attempts</p>
                {(attempts.data ?? []).map((a) => (
                  <div key={String(a.id)} className="flex items-center justify-between">
                    <Badge variant="outline">{a.status}</Badge>
                    <span className="text-muted-foreground">
                      {a.failureReason ?? fmtDateTime(a.assignedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!selectedPersonId}
                loading={assign.isPending}
                onClick={handleAssign}
              >
                {t('staff.orders.assign')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface CancelStaffOrderDialogProps {
  order: OrderResponse | null
  onClose: () => void
}

export function CancelStaffOrderDialog({ order, onClose }: CancelStaffOrderDialogProps) {
  const { t } = useTranslation()
  const cancelOrder = useCancelStaffOrder()
  const [reason, setReason] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)

  const handleConfirm = () => {
    if (!order || reason.trim().length < 2) return
    setServerError(null)
    cancelOrder.mutate(
      { id: order.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(t('orders.cancelSuccess'))
          setReason('')
          onClose()
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {order && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('staff.orders.cancel')} — #{order.id}
              </DialogTitle>
            </DialogHeader>

            {serverError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {serverError}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="staff-cancel-reason">{t('staff.orders.cancelReason')}</Label>
              <Input
                id="staff-cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('common.back')}
              </Button>
              <Button
                variant="destructive"
                disabled={reason.trim().length < 2}
                loading={cancelOrder.isPending}
                onClick={handleConfirm}
              >
                {t('staff.orders.cancel')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
