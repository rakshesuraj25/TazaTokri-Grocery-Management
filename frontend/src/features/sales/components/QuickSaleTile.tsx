import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { isLowStock } from '@/lib/businessRules'
import { dec, formatQty } from '@/lib/money'
import type { StaffCatalogItem } from '@/features/catalog/types'

interface QuickSaleTileProps {
  item: StaffCatalogItem
  inBillQty?: string
  onAddQty: (item: StaffCatalogItem, baseQty: string) => void
  onToggleAvailable: (id: string | number, value: boolean) => void
}

export function QuickSaleTile({
  item,
  inBillQty,
  onAddQty,
  onToggleAvailable,
}: QuickSaleTileProps) {
  const { t } = useTranslation()
  const { name, subtitle } = useVegetableName()
  const [bump, setBump] = useState(false)
  const [lastTappedUnitId, setLastTappedUnitId] = useState<string | number | null>(null)

  const hasPrice = item.pricePerUnit !== null && dec(item.pricePerUnit).gt(0)
  const hasStock = dec(item.stock).gt(0)
  const canSell = hasPrice && hasStock && item.available
  const unitLabel = t(`units.${item.baseUnit}`, { defaultValue: item.baseUnit })
  const sortedOptions = useMemo(
    () =>
      [...item.options].sort((a, b) =>
        dec(a.quantityInBaseUnit).cmp(dec(b.quantityInBaseUnit)),
      ),
    [item.options],
  )

  const defaultOpt = sortedOptions.find((o) => o.defaultOption) ?? sortedOptions[0]
  const activeUnitId =
    inBillQty && dec(inBillQty).gt(0)
      ? (lastTappedUnitId ?? defaultOpt?.unitId ?? null)
      : null

  const triggerAdd = (qty: string, unitId?: string | number) => {
    if (!canSell) return
    if (unitId !== undefined) setLastTappedUnitId(unitId)
    setBump(true)
    setTimeout(() => setBump(false), 240)
    onAddQty(item, qty)
  }

  return (
    <Card
      aria-disabled={!canSell}
      className={`flex h-full flex-col justify-between overflow-hidden transition-shadow duration-200 ${
        inBillQty ? 'ring-primary bg-primary/[0.03] ring-2 shadow-sm' : ''
      } ${!hasStock ? 'bg-surface-subtle/60 opacity-55' : !canSell ? 'opacity-75' : ''}`}
    >
      <div>
        <div
          onClick={() =>
            defaultOpt && triggerAdd(String(defaultOpt.quantityInBaseUnit), defaultOpt.unitId)
          }
          className={`relative ${canSell && defaultOpt ? 'cursor-pointer' : ''}`}
        >
          <VegetableImage
            nameEn={item.nameEn}
            imageUrl={item.imageUrl}
            category={item.category}
            alt={name(item)}
            size="card"
            className={`rounded-none border-x-0 border-t-0 ${bump ? 'animate-bump' : ''}`}
          />

          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {hasStock ? (
              <Badge
                variant={isLowStock(item.stock, item.baseUnit) ? 'warning' : 'secondary'}
                className="bg-card/95 shadow-sm backdrop-blur-sm"
              >
                {formatQty(item.stock)} {unitLabel}
              </Badge>
            ) : (
              <Badge variant="destructive" className="shadow-sm">
                {t('staff.sale.outOfStockBadge')}
              </Badge>
            )}
          </div>

          {inBillQty && dec(inBillQty).gt(0) && (
            <Badge
              variant="default"
              className="absolute bottom-2 left-2 shadow-sm"
            >
              +{formatQty(inBillQty)} {unitLabel}
            </Badge>
          )}
        </div>

        <div className="space-y-2 p-3.5 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div
              onClick={() =>
                defaultOpt && triggerAdd(String(defaultOpt.quantityInBaseUnit), defaultOpt.unitId)
              }
              className={`min-w-0 flex-1 ${canSell && defaultOpt ? 'cursor-pointer' : ''}`}
            >
              <h3 className="font-display text-foreground break-words text-base leading-snug font-bold">
                {name(item)}
              </h3>
              {subtitle(item) && (
                <p className="text-muted-foreground mt-0.5 break-words text-xs leading-snug">
                  {subtitle(item)}
                </p>
              )}
            </div>

            <div
              className="flex shrink-0 items-center pt-0.5"
              title={t('staff.sale.availableToday')}
            >
              <Switch
                checked={item.available}
                onCheckedChange={(v) => onToggleAvailable(item.id, v)}
                aria-label={`${name(item)} ${t('staff.sale.availableToday')}`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
            {hasPrice ? (
              <span className="font-display text-primary text-base font-extrabold">
                <MoneyDisplay value={item.pricePerUnit!} />{' '}
                <span className="text-muted-foreground text-xs font-medium">/ {unitLabel}</span>
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">{t('staff.sale.noPriceBadge')}</Badge>
                <Link
                  to="/staff/pricing"
                  className="text-primary text-xs font-semibold hover:underline"
                >
                  {t('staff.sale.setPriceLink')}
                </Link>
              </div>
            )}

            {!item.available && hasStock && (
              <Badge variant="outline">{t('staff.sale.unavailable')}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Non-truncated one-handed quick-tap size chips (>=44px touch targets) */}
      <div className="flex flex-wrap gap-2 px-3.5 pb-3.5 pt-1">
        {sortedOptions.map((opt) => {
          const isSelected = activeUnitId !== null && String(activeUnitId) === String(opt.unitId)
          return (
            <button
              key={String(opt.unitId)}
              type="button"
              disabled={!canSell}
              onClick={() => triggerAdd(String(opt.quantityInBaseUnit), opt.unitId)}
              aria-pressed={isSelected}
              className={`touch-target inline-flex min-h-11 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-bold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 sm:text-sm ${
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground ring-primary/25 ring-2 shadow-sm'
                  : 'border-border bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary'
              }`}
            >
              <Plus className="size-3.5 shrink-0" aria-hidden />
              <span>{opt.label}</span>
              {opt.defaultOption && <Check className="size-3 shrink-0 opacity-75" aria-hidden />}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
