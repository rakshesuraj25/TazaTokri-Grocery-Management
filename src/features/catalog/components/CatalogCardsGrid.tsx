import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Edit2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { StockMeter } from '@/components/StockMeter'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { getLowStockThreshold } from '@/lib/businessRules'
import { dec } from '@/lib/money'
import { vegetableSlug } from '../vegetableImages'
import type { PhotoAvailability } from '../usePhotoAvailability'
import type { StaffCatalogItem, VegetableResponse } from '../types'

interface CatalogCardsGridProps {
  items: VegetableResponse[]
  staffByVegId: Map<string, StaffCatalogItem>
  photoStatuses: Record<string, PhotoAvailability>
  isOwner: boolean
  onToggleAvail: (id: string | number, value: boolean) => void
  onToggleActive: (id: string | number, value: boolean) => void
}

export function CatalogCardsGrid({
  items,
  staffByVegId,
  photoStatuses,
  isOwner,
  onToggleAvail,
  onToggleActive,
}: CatalogCardsGridProps) {
  const { t } = useTranslation()
  const { name, subtitle } = useVegetableName()

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((veg) => {
        const staffItem = staffByVegId.get(String(veg.id))
        const pricePerUnit = staffItem?.pricePerUnit ?? null
        const stockVal = staffItem?.stock ?? '0'
        const unitLabel = t(`units.${veg.baseUnit}`, { defaultValue: veg.baseUnit })
        const sortedUnits = [...veg.units].sort((a, b) =>
          dec(a.quantityInBaseUnit).cmp(dec(b.quantityInBaseUnit)),
        )
        const hasPhoto = photoStatuses[vegetableSlug(veg.nameEn)] === 'photo'

        return (
          <Card
            key={veg.id}
            className="flex h-full flex-col justify-between gap-3 p-3.5 sm:p-4"
          >
            <div className="space-y-3">
              {/* Compact horizontal header on mobile, edge-free wash + thumb */}
              <div className="flex items-start gap-3 sm:block sm:space-y-3">
                <div className="relative w-20 shrink-0 sm:w-full">
                  <VegetableImage
                    nameEn={veg.nameEn}
                    nameMr={veg.nameMr}
                    nameHi={veg.nameHi}
                    imageUrl={veg.imageUrl ?? staffItem?.imageUrl}
                    category={veg.categoryName}
                    alt={name(veg)}
                    size="card"
                  />
                  {isOwner && (
                    <div className="bg-card/90 absolute top-2 left-2 hidden rounded-full backdrop-blur-xs sm:block">
                      <Badge variant={hasPhoto ? 'success' : 'secondary'}>
                        {hasPhoto
                          ? t('staff.catalog.photoStatusPhoto', { defaultValue: 'Photo' })
                          : t('staff.catalog.photoStatusIllustration', {
                              defaultValue: 'Illustration only',
                            })}
                      </Badge>
                    </div>
                  )}
                  <Button
                    asChild
                    variant="secondary"
                    size="icon"
                    className="touch-target bg-card/90 absolute top-2 right-2 hidden rounded-full shadow-xs backdrop-blur-xs sm:inline-flex"
                  >
                    <Link
                      to={`/staff/catalog/${veg.id}`}
                      aria-label={`${t('common.edit')} ${veg.nameEn}`}
                    >
                      <Edit2 className="size-4" />
                    </Link>
                  </Button>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-display break-words text-base leading-snug font-bold sm:text-lg">
                        {name(veg)}
                      </h2>
                      {subtitle(veg) && (
                        <p className="text-muted-foreground break-words text-xs">
                          {subtitle(veg)}
                        </p>
                      )}
                    </div>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="touch-target shrink-0 sm:hidden"
                    >
                      <Link
                        to={`/staff/catalog/${veg.id}`}
                        aria-label={`${t('common.edit')} ${veg.nameEn}`}
                      >
                        <Edit2 className="size-4" />
                      </Link>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="shrink-0 whitespace-nowrap">
                      {veg.categoryName}
                    </Badge>
                    {pricePerUnit !== null ? (
                      <span className="font-display text-primary text-sm font-extrabold">
                        <MoneyDisplay value={pricePerUnit} /> / {unitLabel}
                      </span>
                    ) : (
                      <Link
                        to="/staff/pricing"
                        className="text-turmeric-foreground bg-turmeric-light inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold hover:underline"
                      >
                        {t('staff.sale.noPriceBadge')} · {t('staff.sale.setPriceLink')}
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <StockMeter
                quantity={stockVal}
                unitLabel={unitLabel}
                lowThreshold={getLowStockThreshold(veg.baseUnit)}
              />

              <div className="flex flex-wrap gap-1">
                {sortedUnits.map((u) => (
                  <Badge
                    key={u.id}
                    variant={u.defaultOption ? 'default' : 'outline'}
                    className="inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    {u.defaultOption && <Check className="size-3 shrink-0" aria-hidden />}
                    <span>{u.label}</span>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-t pt-2.5 text-xs">
              <label className="flex items-center gap-2 font-medium">
                <Switch
                  checked={veg.available}
                  onCheckedChange={(v) => onToggleAvail(veg.id, v)}
                  aria-label={`${veg.nameEn} ${t('staff.catalog.availableToggle')}`}
                />
                <span>{t('staff.catalog.availableToggle')}</span>
              </label>

              {isOwner && (
                <label className="flex items-center gap-2 font-medium">
                  <Switch
                    checked={veg.active}
                    onCheckedChange={(v) => onToggleActive(veg.id, v)}
                    aria-label={`${veg.nameEn} ${t('staff.catalog.activeToggle')}`}
                  />
                  <span>{t('staff.catalog.activeToggle')}</span>
                </label>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
