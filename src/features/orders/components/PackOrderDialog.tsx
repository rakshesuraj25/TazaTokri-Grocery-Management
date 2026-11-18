import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
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
import { EstimatedAmount } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { addMoney, dec, formatQty, isValidDecimal, mulMoney, sumMoney, toApiQty } from '@/lib/money'
import { toApiError } from '@/lib/api'
import { usePackOrder } from '../hooks'
import type { OrderResponse } from '../types'

interface PackOrderDialogProps {
  order: OrderResponse | null
  onClose: () => void
}

export function PackOrderDialog({ order, onClose }: PackOrderDialogProps) {
  const { t } = useTranslation()
  const packOrder = usePackOrder()
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (order) {
      const initial: Record<string, string> = {}
      for (const item of order.items) {
        initial[String(item.vegetableId)] = String(item.actualQuantity ?? item.quantity)
      }
      setWeights(initial)
      setServerError(null)
    }
  }, [order])

  const handleSave = () => {
    if (!order) return
    setServerError(null)
    const items = order.items.map((i) => ({
      vegetableId: i.vegetableId,
      actualQuantity: toApiQty(weights[String(i.vegetableId)] ?? i.quantity),
    }))
    packOrder.mutate(
      { id: order.id, body: { items } },
      {
        onSuccess: () => {
          toast.success(t('orders.status.PACKED'))
          onClose()
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('staff.orders.pack')} — #{order.id}
              </DialogTitle>
            </DialogHeader>

            {serverError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {serverError}
              </p>
            )}

            <div className="space-y-3">
              {order.items.map((item) => {
                const key = String(item.vegetableId)
                const val = weights[key] ?? String(item.quantity)
                const ordered = dec(item.quantity)
                const entered = isValidDecimal(val, 3) ? dec(val) : ordered
                const overLimit = entered.gt(ordered.mul(1.2))

                return (
                  <div key={key} className="flex flex-col gap-2 rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <VegetableImage nameEn={item.vegetableName} size="sm" />
                        <span className="font-display break-words font-bold">
                          {item.vegetableName}
                        </span>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {t('staff.orders.orderedQty')}: {formatQty(item.quantity)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor={`pack-${key}`} className="text-xs">
                        {t('staff.orders.actualQty')}
                      </Label>
                      <Input
                        id={`pack-${key}`}
                        type="number"
                        step="0.05"
                        min="0"
                        value={val}
                        onChange={(e) =>
                          setWeights((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="ml-auto h-10 w-32 font-mono text-sm"
                      />
                    </div>

                    {overLimit && (
                      <p className="text-warning flex items-center gap-1 text-xs font-medium">
                        <AlertTriangle className="size-3.5" />
                        {t('staff.orders.overLimit')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="bg-secondary/60 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm">
              <span className="font-medium">
                {t('staff.orders.packedBillEstimate', {
                  defaultValue: 'Display-only packed bill estimate',
                })}
              </span>
              <EstimatedAmount
                value={addMoney(
                  sumMoney(
                    order.items.map((item) => {
                      const raw = weights[String(item.vegetableId)] ?? String(item.quantity)
                      return mulMoney(item.unitPrice, isValidDecimal(raw, 3) ? raw : item.quantity)
                    }),
                  ),
                  order.deliveryFee,
                ).toFixed(2)}
                className="font-display text-primary font-bold"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} loading={packOrder.isPending}>
                {t('staff.orders.pack')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
