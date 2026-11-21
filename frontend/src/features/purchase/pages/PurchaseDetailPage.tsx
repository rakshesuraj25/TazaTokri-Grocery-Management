import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { toApiError } from '@/lib/api'
import { fmtDate } from '@/lib/dates'
import { formatQty } from '@/lib/money'
import { useCancelPurchase, usePurchase } from '../hooks'

export default function PurchaseDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const purchase = usePurchase(id)
  const cancelPurchase = useCancelPurchase()
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  if (purchase.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <div className="skeleton h-10 w-1/3" />
        <div className="skeleton h-48" />
      </div>
    )
  }

  if (purchase.isError || !purchase.data) {
    return <ErrorState onRetry={() => void purchase.refetch()} />
  }

  const p = purchase.data
  const canCancel = p.status !== 'CANCELLED' && Number(p.paidAmount ?? 0) === 0

  async function handleCancel() {
    try {
      await cancelPurchase.mutateAsync({ id: p.id, reason: cancelReason.trim() || undefined })
      toast.success('Purchase cancelled and stock reversed')
      setShowCancel(false)
    } catch (err) {
      toast.error(toApiError(err).message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/staff/purchases" aria-label={t('common.back')}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold">
                {t('staff.purchase.purchaseDetail', { id: p.id })}
              </h1>
              {p.invoiceNumber && <Badge variant="outline">{p.invoiceNumber}</Badge>}
              <Badge variant={p.status === 'CANCELLED' ? 'destructive' : 'default'}>
                {p.paymentStatus ?? p.status ?? 'COMPLETED'}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              <Link to={`/staff/suppliers/${p.supplierId}`} className="underline">
                {p.supplierName}
              </Link>{' '}
              · {fmtDate(p.purchaseDate)}
            </p>
          </div>
        </div>

        {canCancel && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="rounded-full"
            onClick={() => setShowCancel((v) => !v)}
          >
            <Ban className="size-4" /> Cancel Purchase
          </Button>
        )}
      </div>

      {showCancel && (
        <Card className="border-destructive/40 space-y-3 p-4">
          <p className="text-sm font-semibold">
            Cancel this purchase? This will reverse stock movements for all items.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Cancellation reason (optional)"
              className="flex-1"
            />
            <Button
              type="button"
              variant="destructive"
              disabled={cancelPurchase.isPending}
              onClick={handleCancel}
            >
              {cancelPurchase.isPending ? 'Cancelling...' : 'Confirm Cancel'}
            </Button>
          </div>
        </Card>
      )}

      {p.status === 'CANCELLED' && p.cancelReason && (
        <Card className="border-destructive/30 p-3 text-xs text-destructive">
          Cancelled: {p.cancelReason}
        </Card>
      )}

      <Card className="divide-border divide-y">
        {p.items.map((item) => (
          <div
            key={String(item.vegetableId)}
            className="flex flex-wrap items-center justify-between gap-2 p-4"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <VegetableImage nameEn={item.vegetableName} size="xs" />
              <div className="min-w-0">
                <h2 className="font-display truncate font-bold">{item.vegetableName}</h2>
                <p className="text-muted-foreground text-xs">
                  {formatQty(item.quantity)} {item.unit ?? ''} × <MoneyDisplay value={item.ratePerUnit} /> ·{' '}
                  {t('staff.purchase.transportShare')}: <MoneyDisplay value={item.transportShare} />
                </p>
              </div>
            </div>
            <div className="text-right">
              <MoneyDisplay value={item.lineCost} className="font-display font-bold" />
              <div className="mt-0.5">
                <Badge variant="secondary">
                  {t('staff.purchase.landedCost')}: <MoneyDisplay value={item.landedCostPerUnit} />
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">
            {t('staff.purchase.transportCost')}: <MoneyDisplay value={p.transportCost} />
          </p>
          {p.paidAmount !== undefined && (
            <p className="text-xs">
              Paid: <MoneyDisplay value={p.paidAmount} className="font-semibold text-emerald-700" /> ·
              Outstanding:{' '}
              <MoneyDisplay value={p.outstandingAmount ?? 0} className="font-semibold text-amber-700" />
            </p>
          )}
          {p.note && <p className="text-xs">{p.note}</p>}
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">{t('staff.purchase.totalCost')}</p>
          <MoneyDisplay
            value={p.totalCost}
            className="font-display text-primary text-xl font-extrabold"
          />
        </div>
      </Card>
    </div>
  )
}
