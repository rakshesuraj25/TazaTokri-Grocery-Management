import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, Minus, Plus, ShoppingBasket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PriceTag } from '@/components/PriceTag'
import { StatusBadge } from '@/components/StatusBadge'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { useCartStore } from '@/features/cart/store'
import { useFavouritesStore } from '../favouritesStore'
import { sortPublicOptions } from '../shopHelpers'
import type { PublicUnitOption, PublicVegetable } from '../types'

interface VegetableCardProps {
  vegetable: PublicVegetable
}

export function VegetableCard({ vegetable }: VegetableCardProps) {
  const { t } = useTranslation()
  const { name, subtitle } = useVegetableName()
  const sortedOptions = useMemo(
    () => sortPublicOptions(vegetable.options),
    [vegetable.options],
  )
  const defaultOpt = sortedOptions.find((o) => o.defaultOption) ?? sortedOptions[0]
  const [selectedUnitId, setSelectedUnitId] = useState<string | number | undefined>(
    defaultOpt?.unitId,
  )
  const [bump, setBump] = useState(false)

  // Always resolve against current options so async catalog refreshes keep valid selection
  const selectedUnit: PublicUnitOption | undefined =
    sortedOptions.find((o) => String(o.unitId) === String(selectedUnitId)) ?? defaultOpt

  const addItem = useCartStore((s) => s.addItem)
  const updateCount = useCartStore((s) => s.updateCount)
  const cartItems = useCartStore((s) => s.items)
  const toggleFavourite = useFavouritesStore((s) => s.toggleFavourite)
  const isFav = useFavouritesStore((s) => s.ids.includes(String(vegetable.id)))

  const inCart = selectedUnit
    ? cartItems.find(
        (i) =>
          String(i.vegetableId) === String(vegetable.id) &&
          String(i.unitId) === String(selectedUnit.unitId),
      )
    : undefined

  const unitLabel = t(`units.${vegetable.baseUnit}`, { defaultValue: vegetable.baseUnit })
  const hasPrice =
    selectedUnit?.price !== null &&
    selectedUnit?.price !== undefined &&
    selectedUnit?.price !== ''

  const handleAdd = () => {
    if (!selectedUnit || !hasPrice || !vegetable.inStock) return
    addItem({
      vegetableId: String(vegetable.id),
      unitId: String(selectedUnit.unitId),
      count: 1,
      nameEn: vegetable.nameEn,
      nameMr: vegetable.nameMr ?? undefined,
      nameHi: vegetable.nameHi ?? undefined,
      unitLabel: selectedUnit.label,
      pricePerUnit: String(selectedUnit.price),
      quantityInBaseUnit: String(selectedUnit.quantityInBaseUnit),
    })
    setBump(true)
    setTimeout(() => setBump(false), 240)
  }

  return (
    <Card className="bg-card flex h-full flex-col justify-between overflow-hidden rounded-2xl transition-shadow duration-200 hover:shadow-md">
      <div>
        {/* Edge-to-edge 1:1 vegetable photo / category wash illustration (no inner border box) */}
        <div className={`relative ${bump ? 'animate-bump' : ''}`}>
          <VegetableImage
            nameEn={vegetable.nameEn}
            nameMr={vegetable.nameMr}
            nameHi={vegetable.nameHi}
            imageUrl={vegetable.imageUrl}
            category={vegetable.category}
            alt={name(vegetable)}
            size="card"
            className="rounded-none border-0"
          />
          <button
            type="button"
            onClick={() => toggleFavourite(vegetable.id)}
            aria-label={t('shop.favouriteToggle', {
              name: name(vegetable),
              defaultValue: `Favourite ${name(vegetable)}`,
            })}
            aria-pressed={isFav}
            className="touch-target bg-card/90 text-foreground hover:text-tomato absolute top-2.5 left-2.5 flex items-center justify-center rounded-full shadow-xs backdrop-blur-xs transition-colors duration-150"
          >
            <Heart
              className={`size-4 ${isFav ? 'fill-tomato text-tomato' : ''}`}
              aria-hidden
            />
          </button>
          <div className="absolute top-2.5 right-2.5">
            {/* Customer view strictly shows "In stock" or "Out of stock" — never "Low stock" */}
            <StatusBadge
              kind="stock"
              status={vegetable.inStock ? 'IN_STOCK' : 'OUT_OF_STOCK'}
              className="shadow-xs backdrop-blur-xs"
            />
          </div>
        </div>

        <div className="space-y-3 p-4 pb-3">
          {/* Native-language name large, secondary English name small, base price prominent */}
          <div className="space-y-1">
            <h3 className="font-organic text-foreground break-words text-lg leading-snug font-bold sm:text-xl">
              {name(vegetable)}
            </h3>
            {subtitle(vegetable) && (
              <p className="text-muted-foreground break-words text-xs font-medium">
                {subtitle(vegetable)}
              </p>
            )}
          </div>

          <PriceTag price={vegetable.pricePerUnit} unitLabel={unitLabel} size="lg" />

          {/* Ascending label-only size chips with subtle default dot */}
          <div
            className="flex flex-wrap gap-1.5"
            role="radiogroup"
            aria-label={t('shop.chooseSize')}
          >
            {sortedOptions.map((opt) => {
              const active = selectedUnit?.unitId === opt.unitId
              return (
                <button
                  key={opt.unitId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelectedUnitId(opt.unitId)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors duration-150 ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-2xs'
                      : 'border-border bg-secondary/70 text-secondary-foreground hover:bg-secondary'
                  }`}
                >
                  {opt.defaultOption && (
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${
                        active ? 'bg-primary-foreground' : 'bg-primary'
                      }`}
                    />
                  )}
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selected unit rate + Add / Stepper */}
      <div className="border-border/70 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
        <div className="min-w-0">
          <PriceTag
            price={selectedUnit?.price ?? null}
            unitLabel={selectedUnit?.label}
            size="md"
          />
        </div>

        {!vegetable.inStock || !hasPrice ? (
          <StatusBadge kind="stock" status="OUT_OF_STOCK" />
        ) : inCart ? (
          <div className="flex items-center gap-1.5" aria-live="polite">
            <button
              type="button"
              onClick={() =>
                updateCount(String(vegetable.id), String(selectedUnit!.unitId), inCart.count - 1)
              }
              aria-label={t('common.decrease', { defaultValue: 'Decrease' })}
              className="touch-target bg-secondary text-secondary-foreground inline-flex items-center justify-center rounded-full transition-colors duration-150"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="money-num w-6 text-center text-sm font-bold">{inCart.count}</span>
            <button
              type="button"
              onClick={() =>
                updateCount(String(vegetable.id), String(selectedUnit!.unitId), inCart.count + 1)
              }
              aria-label={t('common.increase', { defaultValue: 'Increase' })}
              className="touch-target bg-primary text-primary-foreground inline-flex items-center justify-center rounded-full transition-colors duration-150"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <Button size="sm" onClick={handleAdd} className="min-h-11 rounded-full px-4">
            <ShoppingBasket className="size-4 shrink-0" aria-hidden />
            <span>{t('shop.addToCart')}</span>
          </Button>
        )}
      </div>
    </Card>
  )
}
