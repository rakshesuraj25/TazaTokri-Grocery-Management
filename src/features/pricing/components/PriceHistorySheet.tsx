import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { useVegetableName } from '@/hooks/useVegetableName'
import { fmtDateTime } from '@/lib/dates'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { usePriceHistory } from '../hooks'

interface PriceHistorySheetProps {
  vegetable: StaffCatalogItem | null
  onClose: () => void
}

export function PriceHistorySheet({ vegetable, onClose }: PriceHistorySheetProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const history = usePriceHistory(vegetable?.id, 0)

  return (
    <Sheet open={Boolean(vegetable)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        {vegetable && (
          <>
            <SheetHeader>
              <SheetTitle>
                {t('staff.pricing.priceHistory')} — {name(vegetable)}
              </SheetTitle>
            </SheetHeader>

            {history.isLoading ? (
              <div className="space-y-2 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-14" />
                ))}
              </div>
            ) : history.isError ? (
              <ErrorState onRetry={() => void history.refetch()} />
            ) : (history.data ?? []).length === 0 ? (
              <EmptyState title={t('common.noData')} />
            ) : (
              <ul className="divide-border divide-y rounded-xl border">
                {(history.data ?? []).map((row, idx) => (
                  <li key={`${row.createdAt}-${idx}`} className="flex items-center justify-between p-3">
                    <div>
                      <Badge variant="outline">{row.source}</Badge>
                      {row.note && <p className="mt-0.5 text-xs">{row.note}</p>}
                      <p className="text-muted-foreground text-xs">{fmtDateTime(row.createdAt)}</p>
                    </div>
                    <MoneyDisplay
                      value={row.pricePerUnit}
                      className="font-display text-primary text-base font-extrabold"
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
