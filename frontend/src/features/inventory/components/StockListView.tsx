import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { History, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { StatusBadge } from '@/components/StatusBadge'
import { StockMeter } from '@/components/StockMeter'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import type { StaffCatalogItem } from '@/features/catalog/types'
import {
  getLowStockThreshold,
  isLowStock,
  type LowStockThresholds,
} from '@/lib/businessRules'
import { dec, formatQty } from '@/lib/money'
import { deriveProductVisibility } from '@/features/catalog/visibility'
import { VisibilityStatusBlock } from '@/features/catalog/components/VisibilityStatusBadge'
import type { QuickPriceTarget } from '@/features/catalog/components/QuickPriceDialog'

interface StockListViewProps {
  items: StaffCatalogItem[]
  view: 'cards' | 'table'
  isOwner: boolean
  thresholds?: Partial<LowStockThresholds>
  onToggleAvail: (id: string | number, value: boolean) => void
  onWastage: (item: StaffCatalogItem) => void
  onAdjust: (item: StaffCatalogItem) => void
  onMovements: (item: StaffCatalogItem) => void
  onQuickPrice?: (target: QuickPriceTarget) => void
}

export function StockListView({
  items,
  view,
  isOwner,
  thresholds,
  onToggleAvail,
  onWastage,
  onAdjust,
  onMovements,
  onQuickPrice,
}: StockListViewProps) {
  const { t } = useTranslation()
  const { name, subtitle } = useVegetableName()

  if (view === 'table') {
    return (
      <div className="bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2.5">{t('staff.catalog.nameEn', { defaultValue: 'Vegetable' })}</th>
              <th className="px-3 py-2.5">{t('staff.stock.currentStock')}</th>
              <th className="px-3 py-2.5">{t('staff.stock.availableToggle')}</th>
              <th className="px-3 py-2.5 text-right">{t('common.actions', { defaultValue: 'Actions' })}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const unitLabel = t(`units.${item.baseUnit}`, { defaultValue: item.baseUnit })
              const isOut = dec(item.stock).lte(0)
              const isLow = isLowStock(item.stock, item.baseUnit, thresholds)
              const thresholdVal = getLowStockThreshold(item.baseUnit, thresholds)
              const visibility = deriveProductVisibility({
                active: true,
                available: item.available,
                pricePerUnit: item.pricePerUnit,
                stock: item.stock,
              })

              return (
                <tr
                  key={String(item.id)}
                  className={
                    isOut
                      ? 'bg-destructive/[0.04]'
                      : isLow
                        ? 'bg-turmeric-light/20'
                        : ''
                  }
                >
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <VegetableImage
                        nameEn={item.nameEn}
                        imageUrl={item.imageUrl}
                        category={item.category}
                        alt={name(item)}
                        size="xs"
                      />
                      <span className="font-semibold">{name(item)}</span>
                      {isOut ? (
                        <StatusBadge kind="stock" status="OUT_OF_STOCK" />
                      ) : isLow ? (
                        <StatusBadge kind="stock" status="LOW_STOCK" />
                      ) : null}
                    </div>
                    <div className="mt-1.5">
                      <VisibilityStatusBlock
                        visibility={visibility}
                        editTo={`/staff/catalog/${item.id}`}
                        onQuickPrice={
                          onQuickPrice
                            ? () =>
                                onQuickPrice({
                                  id: item.id,
                                  name: name(item),
                                  baseUnit: item.baseUnit,
                                  currentPrice: item.pricePerUnit,
                                })
                            : undefined
                        }
                        onQuickEnableAvailable={() => onToggleAvail(item.id, true)}
                      />
                    </div>
                  </td>
                  <td className="min-w-36 px-3 py-2.5">
                    <StockMeter
                      quantity={item.stock}
                      unitLabel={unitLabel}
                      lowThreshold={thresholdVal}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Switch
                      checked={item.available}
                      onCheckedChange={(v) => onToggleAvail(item.id, v)}
                      aria-label={`${name(item)} ${t('staff.stock.availableToggle')}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => onWastage(item)}>
                        {t('staff.stock.recordWastage')}
                      </Button>
                      {isOwner && (
                        <Button variant="outline" size="sm" onClick={() => onAdjust(item)}>
                          {t('staff.stock.adjustStock')}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onMovements(item)}>
                        <History className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {items.map((item) => {
        const unitLabel = t(`units.${item.baseUnit}`, { defaultValue: item.baseUnit })
        const isOut = dec(item.stock).lte(0)
        const isLow = isLowStock(item.stock, item.baseUnit, thresholds)
        const thresholdVal = getLowStockThreshold(item.baseUnit, thresholds)
        const visibility = deriveProductVisibility({
          active: true,
          available: item.available,
          pricePerUnit: item.pricePerUnit,
          stock: item.stock,
        })

        return (
          <Card
            key={String(item.id)}
            className={`flex flex-col justify-between gap-3 p-4 ${
              isOut
                ? 'border-destructive/50 bg-destructive/[0.02]'
                : isLow
                  ? 'border-turmeric/60 bg-turmeric-light/15'
                  : ''
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <VegetableImage
                  nameEn={item.nameEn}
                  imageUrl={item.imageUrl}
                  category={item.category}
                  alt={name(item)}
                  size="md"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display break-words text-lg font-bold">{name(item)}</h2>
                    {isOut ? (
                      <StatusBadge kind="stock" status="OUT_OF_STOCK" />
                    ) : isLow ? (
                      <StatusBadge
                        kind="stock"
                        status="LOW_STOCK"
                        label={`${formatQty(item.stock)} ${unitLabel}`}
                      />
                    ) : (
                      <Badge variant="secondary">
                        {formatQty(item.stock)} {unitLabel}
                      </Badge>
                    )}
                  </div>
                  {subtitle(item) && (
                    <p className="text-muted-foreground text-xs break-words">{subtitle(item)}</p>
                  )}
                  <StockMeter
                    quantity={item.stock}
                    unitLabel={unitLabel}
                    lowThreshold={thresholdVal}
                  />
                  {item.pricePerUnit !== null ? (
                    <p className="text-muted-foreground text-xs">
                      <MoneyDisplay value={item.pricePerUnit} /> / {unitLabel}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <StatusBadge kind="price" status="NOT_SET" />
                      <Link
                        to="/staff/pricing"
                        className="text-primary text-xs font-semibold hover:underline"
                      >
                        {t('staff.sale.setPriceLink')}
                      </Link>
                    </div>
                  )}
                  <VisibilityStatusBlock
                    visibility={visibility}
                    editTo={`/staff/catalog/${item.id}`}
                    onQuickPrice={
                      onQuickPrice
                        ? () =>
                            onQuickPrice({
                              id: item.id,
                              name: name(item),
                              baseUnit: item.baseUnit,
                              currentPrice: item.pricePerUnit,
                            })
                        : undefined
                    }
                    onQuickEnableAvailable={() => onToggleAvail(item.id, true)}
                  />
                </div>
              </div>

              <label className="flex shrink-0 items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium sm:justify-start sm:border-0 sm:p-0 print:hidden">
                <span className="text-muted-foreground">{t('staff.stock.availableToggle')}</span>
                <Switch
                  checked={item.available}
                  onCheckedChange={(v) => onToggleAvail(item.id, v)}
                  aria-label={`${name(item)} ${t('staff.stock.availableToggle')}`}
                />
              </label>
            </div>

            <div className="border-border/70 flex flex-wrap items-center gap-2 border-t pt-2.5 print:hidden">
              <Button variant="outline" size="sm" onClick={() => onWastage(item)} className="rounded-full">
                <Trash2 className="size-3.5" />
                {t('staff.stock.recordWastage')}
              </Button>

              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => onAdjust(item)} className="rounded-full">
                  <SlidersHorizontal className="size-3.5" />
                  {t('staff.stock.adjustStock')}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="ml-auto rounded-full"
                onClick={() => onMovements(item)}
              >
                <History className="size-3.5" />
                {t('staff.stock.movements')}
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
