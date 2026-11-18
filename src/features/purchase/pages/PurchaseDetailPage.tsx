import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { fmtDate } from '@/lib/dates'
import { formatQty } from '@/lib/money'
import { usePurchase } from '../hooks'

export default function PurchaseDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const purchase = usePurchase(id)

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

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/staff/purchases" aria-label={t('common.back')}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            {t('staff.purchase.purchaseDetail', { id: p.id })}
          </h1>
          <p className="text-muted-foreground text-xs">
            {p.supplierName} · {fmtDate(p.purchaseDate)}
          </p>
        </div>
      </div>

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
                  {formatQty(item.quantity)} × <MoneyDisplay value={item.ratePerUnit} /> ·{' '}
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

      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-muted-foreground text-xs">
            {t('staff.purchase.transportCost')}: <MoneyDisplay value={p.transportCost} />
          </p>
          {p.note && <p className="mt-1 text-xs">{p.note}</p>}
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
