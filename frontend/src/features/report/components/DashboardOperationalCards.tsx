import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { formatMoney, formatQty } from '@/lib/money'
import type Decimal from 'decimal.js'

interface DashboardOperationalCardsProps {
  outOfStockItems: StaffCatalogItem[]
  lowStockItems: StaffCatalogItem[]
  cashHeldTotal: Decimal
  missingPhotosCount: number
  totalPhotoTargets: number
}

export function DashboardOperationalCards({
  outOfStockItems,
  lowStockItems,
  cashHeldTotal,
  missingPhotosCount,
  totalPhotoTargets,
}: DashboardOperationalCardsProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold">
                {t('staff.dashboard.stockAlertsTitle', { defaultValue: 'Low & out-of-stock alerts' })}
              </h2>
              <p className="text-muted-foreground text-xs">
                {t('staff.dashboard.outCount', {
                  count: outOfStockItems.length,
                  defaultValue: '{{count}} out of stock',
                })}{' '}
                ·{' '}
                {t('staff.dashboard.lowCount', {
                  count: lowStockItems.length,
                  defaultValue: '{{count}} low stock',
                })}
              </p>
            </div>
            <Link to="/staff/stock" className="text-primary text-xs font-bold hover:underline">
              {t('staff.stock.title')} →
            </Link>
          </div>
          {(outOfStockItems.length > 0 || lowStockItems.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {outOfStockItems.slice(0, 4).map((v) => (
                <Badge key={`out-${v.id}`} variant="destructive">
                  {v.nameEn} (0)
                </Badge>
              ))}
              {lowStockItems.slice(0, 4).map((v) => (
                <Badge key={`low-${v.id}`} variant="warning">
                  {v.nameEn} ({formatQty(v.stock)})
                </Badge>
              ))}
            </div>
          )}
        </Card>

        <Link
          to="/staff/payments"
          className="border-border bg-card hover:bg-muted/40 flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors"
        >
          <div className="space-y-1">
            <h2 className="font-display text-sm font-bold">
              {t('staff.dashboard.paymentsRefundsTitle', {
                defaultValue: 'Cash settlements & refunds',
              })}
            </h2>
            <p className="text-muted-foreground text-xs">
              {t('staff.dashboard.paymentsRefundsHint', {
                defaultValue:
                  'Verify COD cash held ({{amount}}) and check or initiate per-order refunds.',
                amount: formatMoney(cashHeldTotal),
              })}
            </p>
          </div>
          <span className="text-primary shrink-0 text-xs font-bold">
            {t('nav.payments')} →
          </span>
        </Link>
      </div>

      <Link
        to="/staff/catalog/images"
        className="border-border bg-card hover:bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="bg-muted text-primary rounded-xl p-2">
            <ImageIcon className="size-5" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-bold">
              {t('staff.dashboard.missingPhotos', { defaultValue: 'Missing photos' })}:{' '}
              <span className="money-num">
                {missingPhotosCount} / {totalPhotoTargets}
              </span>
            </p>
            <p className="text-muted-foreground text-xs">
              {t('staff.dashboard.missingPhotosHint')}
            </p>
          </div>
        </div>
        <span className="text-primary text-xs font-bold">
          {t('staff.dashboard.reviewImages', { defaultValue: 'Open image review' })} →
        </span>
      </Link>
    </div>
  )
}
