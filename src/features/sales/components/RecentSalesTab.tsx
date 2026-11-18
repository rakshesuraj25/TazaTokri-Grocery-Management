import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { fmtTime, todayIST } from '@/lib/dates'
import { useSalesByDate } from '../hooks'
import type { SaleResponse } from '../types'

interface RecentSalesTabProps {
  onSelectSale: (sale: SaleResponse) => void
  onRepeatSale?: (sale: SaleResponse) => void
}

export function RecentSalesTab({ onSelectSale, onRepeatSale }: RecentSalesTabProps) {
  const { t } = useTranslation()
  const [date, setDate] = useState(() => todayIST())
  const recentSales = useSalesByDate(date)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={date}
          max={todayIST()}
          onChange={(e) => setDate(e.target.value)}
          aria-label={t('staff.sale.saleDate', { defaultValue: 'Sale date' })}
          className="w-44"
        />
      </div>

      {recentSales.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      ) : recentSales.isError ? (
        <ErrorState onRetry={() => void recentSales.refetch()} />
      ) : (recentSales.data ?? []).length === 0 ? (
        <EmptyState title={t('staff.sale.noRecentSales')} />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(recentSales.data ?? []).map((sale) => (
            <Card
              key={String(sale.id)}
              className="hover:border-primary/60 flex items-center justify-between gap-2 p-4 transition-colors"
            >
              <button
                type="button"
                onClick={() => onSelectSale(sale)}
                className="min-w-0 flex-1 text-left focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <p className="font-display font-bold">#{sale.id}</p>
                  <Badge variant="secondary">{sale.paymentMethod}</Badge>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {fmtTime(sale.createdAt)} · {sale.items.length} {t('common.items')}
                </p>
              </button>

              <div className="flex shrink-0 items-center gap-2">
                <MoneyDisplay
                  value={sale.totalAmount}
                  className="font-display text-primary text-lg font-extrabold"
                />
                {onRepeatSale && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRepeatSale(sale)}
                    title={t('staff.sale.repeatLastBill', { defaultValue: 'Repeat last bill' })}
                    aria-label={`${t('staff.sale.repeatLastBill', { defaultValue: 'Repeat last bill' })} #${sale.id}`}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
