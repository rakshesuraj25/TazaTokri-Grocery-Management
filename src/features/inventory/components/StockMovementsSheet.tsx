import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { useVegetableName } from '@/hooks/useVegetableName'
import { fmtDateTime } from '@/lib/dates'
import { dec, formatQty } from '@/lib/money'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { useStockMovements } from '../hooks'

interface StockMovementsSheetProps {
  vegetable: StaffCatalogItem | null
  onClose: () => void
}

/** Append-only stock ledger viewer (newest first). */
export function StockMovementsSheet({ vegetable, onClose }: StockMovementsSheetProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const [page, setPage] = useState(0)

  const movements = useStockMovements(vegetable?.id, page)
  const list = movements.data ?? []

  return (
    <Sheet
      open={Boolean(vegetable)}
      onOpenChange={(open) => {
        if (!open) {
          setPage(0)
          onClose()
        }
      }}
    >
      <SheetContent side="right">
        {vegetable && (
          <>
            <SheetHeader>
              <SheetTitle>
                {t('staff.stock.movements')} — {name(vegetable)}
              </SheetTitle>
              <p className="text-muted-foreground text-xs">
                {t('staff.stock.currentStock')}: {formatQty(vegetable.stock)}{' '}
                {t(`units.${vegetable.baseUnit}`, { defaultValue: vegetable.baseUnit })}
              </p>
            </SheetHeader>

            {movements.isLoading ? (
              <div className="space-y-2 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-16" />
                ))}
              </div>
            ) : movements.isError ? (
              <ErrorState onRetry={() => void movements.refetch()} />
            ) : list.length === 0 ? (
              <EmptyState title={t('staff.stock.noMovements')} />
            ) : (
              <div className="space-y-3 pt-2">
                <ul className="divide-border divide-y rounded-xl border">
                  {list.map((m) => {
                    const positive = dec(m.quantity).gt(0)
                    return (
                      <li key={String(m.id)} className="flex items-start justify-between gap-2 p-3">
                        <div className="space-y-0.5">
                          <Badge variant={positive ? 'secondary' : 'outline'}>
                            {t(`staff.stock.movementTypes.${m.type}`, { defaultValue: m.type })}
                          </Badge>
                          {m.note && <p className="text-xs font-medium">{m.note}</p>}
                          <p className="text-muted-foreground text-xs">{fmtDateTime(m.createdAt)}</p>
                        </div>
                        <span
                          className={`font-display text-sm font-extrabold ${
                            positive ? 'text-primary' : 'text-tomato'
                          }`}
                        >
                          {positive ? '+' : ''}
                          {formatQty(m.quantity)} {vegetable.baseUnit}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    {t('common.back')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={list.length === 0}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('staff.stock.loadMore')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
