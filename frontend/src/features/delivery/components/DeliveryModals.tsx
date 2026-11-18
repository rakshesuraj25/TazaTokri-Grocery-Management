import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, CheckCircle2, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dec, formatMoney, toApiMoney } from '@/lib/money'
import { toApiError } from '@/lib/api'
import { useMarkDelivered, useMarkFailed } from '../hooks'
import type { DeliveryOrder } from '../types'

interface DeliverOrderDialogProps {
  order: DeliveryOrder | null
  onClose: () => void
}

export function DeliverOrderDialog({ order, onClose }: DeliverOrderDialogProps) {
  const { t } = useTranslation()
  const markDelivered = useMarkDelivered()
  const [collectMethod, setCollectMethod] = useState<'CASH' | 'UPI_QR'>('CASH')
  const [upiRef, setUpiRef] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)

  useEffect(() => {
    setCollectMethod('CASH')
    setUpiRef('')
    setDialogError(null)
  }, [order])

  const handleConfirm = () => {
    if (!order) return
    setDialogError(null)
    const needsCollection = dec(order.amountToCollect).gt(0)

    if (needsCollection && collectMethod === 'UPI_QR' && upiRef.trim().length < 4) {
      setDialogError(
        t('delivery.upiReferenceRequired', {
          defaultValue: 'Enter the UPI transaction reference (at least 4 characters).',
        }),
      )
      return
    }

    markDelivered.mutate(
      {
        orderId: order.orderId,
        body: needsCollection
          ? {
              method: collectMethod,
              amountCollected: toApiMoney(order.amountToCollect),
              reference: collectMethod === 'UPI_QR' ? upiRef.trim() : undefined,
            }
          : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('delivery.deliveredSuccess'))
          onClose()
        },
        onError: (err) => setDialogError(toApiError(err).message),
      },
    )
  }

  return (
    <Sheet open={Boolean(order)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl">
        {order && (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>
                {t('delivery.deliver')} — #{order.orderId}
              </SheetTitle>
            </SheetHeader>

            {dialogError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {dialogError}
              </p>
            )}

            {dec(order.amountToCollect).gt(0) ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  {(['CASH', 'UPI_QR'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={collectMethod === m}
                      onClick={() => setCollectMethod(m)}
                      className={`touch-target flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold ${
                        collectMethod === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card'
                      }`}
                    >
                      {m === 'CASH' ? (
                        <Banknote className="size-4" />
                      ) : (
                        <QrCode className="size-4" />
                      )}
                      {m === 'CASH' ? t('delivery.cash') : t('delivery.upiQr')}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="del-amt">{t('delivery.amountCollected')}</Label>
                  <Input
                    id="del-amt"
                    type="text"
                    readOnly
                    value={formatMoney(order.amountToCollect)}
                    aria-readonly="true"
                    className="bg-muted font-display text-lg font-bold"
                  />
                  <p className="text-muted-foreground text-xs">
                    {t('delivery.exactAmountNote', {
                      defaultValue: 'Exact bill amount must be collected in full.',
                    })}
                  </p>
                </div>

                {collectMethod === 'UPI_QR' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="del-ref">{t('delivery.upiReference')}</Label>
                    <Input
                      id="del-ref"
                      value={upiRef}
                      onChange={(e) => setUpiRef(e.target.value)}
                      placeholder="UTR / Transaction ID"
                      required
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-secondary/70 flex items-center gap-2 rounded-xl p-3 text-sm font-semibold">
                <CheckCircle2 className="text-primary size-5 shrink-0" aria-hidden />
                <span>{t('delivery.prepaidCollectNothing')}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" size="lg" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button size="lg" loading={markDelivered.isPending} onClick={handleConfirm}>
                {t('delivery.deliver')}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

interface FailOrderDialogProps {
  order: DeliveryOrder | null
  onClose: () => void
}

export function FailOrderDialog({ order, onClose }: FailOrderDialogProps) {
  const { t } = useTranslation()
  const markFailed = useMarkFailed()
  const [reason, setReason] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)

  const quickReasons = [
    t('delivery.failCustomerUnavailable', { defaultValue: 'Customer unavailable' }),
    t('delivery.failWrongAddress', { defaultValue: 'Wrong or incomplete address' }),
    t('delivery.failRefused', { defaultValue: 'Customer refused delivery' }),
    t('delivery.failPhoneUnreachable', { defaultValue: 'Phone unreachable' }),
  ]

  useEffect(() => {
    setReason('')
    setDialogError(null)
  }, [order])

  const handleConfirm = () => {
    if (!order || reason.trim().length < 2) return
    setDialogError(null)
    markFailed.mutate(
      { orderId: order.orderId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.info(t('delivery.fail'))
          setReason('')
          onClose()
        },
        onError: (err) => setDialogError(toApiError(err).message),
      },
    )
  }

  return (
    <Sheet open={Boolean(order)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl">
        {order && (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>
                {t('delivery.fail')} — #{order.orderId}
              </SheetTitle>
            </SheetHeader>

            {dialogError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {dialogError}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={reason === r ? 'destructive' : 'outline'}
                  onClick={() => setReason(r)}
                >
                  {r}
                </Button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fail-reason">{t('delivery.failReason')}</Label>
              <Input
                id="fail-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" size="lg" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                disabled={reason.trim().length < 2}
                loading={markFailed.isPending}
                onClick={handleConfirm}
              >
                {t('delivery.fail')}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
