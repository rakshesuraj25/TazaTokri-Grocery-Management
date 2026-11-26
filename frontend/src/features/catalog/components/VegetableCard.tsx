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
import { MAX_ITEM_COUNT } from '@/lib/businessRules'
import { dec } from '@/lib/money'
import { useFavouritesStore } from '../favouritesStore'
import { sortPublicOptions } from '../shopHelpers'
import type { PublicUnitOption, PublicVegetable } from '../types'

interface VegetableCardProps {
  vegetable: PublicVegetable
  priority?: boolean
}

export function VegetableCard({ vegetable, priority = false }: VegetableCardProps) {
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

  // Total base-unit quantity of this vegetable already in cart across all options
  const totalBaseInCart = useMemo(() => {
    return cartItems
      .filter((i) => String(i.vegetableId) === String(vegetable.id))
      .reduce((acc, i) => acc.add(dec(i.quantityInBaseUnit).mul(i.count)), dec(0))
  }, [cartItems, vegetable.id])

  const hasExplicitStock =
    vegetable.availableStock !== undefined &&
    vegetable.availableStock !== null &&
    vegetable.availableStock !== ''
  const availableStockDec = hasExplicitStock ? dec(vegetable.availableStock) : null

  const selectedUnitBaseQty = selectedUnit ? dec(selectedUnit.quantityInBaseUnit) : dec(0)
  const exceedsStockToAddOne =
    availableStockDec !== null &&
    totalBaseInCart.add(selectedUnitBaseQty).gt(availableStockDec)

  const unitLabel = t(`units.${vegetable.baseUnit}`, { defaultValue: vegetable.baseUnit })
  const hasPrice =
    selectedUnit?.price !== null &&
    selectedUnit?.price !== undefined &&
    selectedUnit?.price !== ''

  const canAddSelected =
    Boolean(selectedUnit) &&
    hasPrice &&
    vegetable.inStock &&
    !exceedsStockToAddOne &&
    (inCart?.count ?? 0) < MAX_ITEM_COUNT

  const handleAdd = () => {
    if (!selectedUnit || !canAddSelected) return
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
      availableStock:
        vegetable.availableStock !== undefined && vegetable.availableStock !== null
          ? String(vegetable.availableStock)
          : undefined,
    })
  }

  return (
    <Card className="bg-card border-border group flex h-full flex-col justify-between overflow-hidden rounded-[14px] border shadow-[var(--shadow-card)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-floating)] sm:rounded-[16px]">
      <div>
        {/* Edge-to-edge 1:1 vegetable photo with warm neutral backdrop */}
        <div className="bg-background relative overflow-hidden">
          <VegetableImage
            nameEn={vegetable.nameEn}
            nameMr={vegetable.nameMr}
            nameHi={vegetable.nameHi}
            imageUrl={vegetable.imageUrl}
            category={vegetable.category}
            alt={name(vegetable)}
            size="card"
            priority={priority}
            className="rounded-none border-0 transition-transform duration-200 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
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
          {!vegetable.inStock && (
            <div className="absolute top-2.5 right-2.5">
              <StatusBadge
                kind="stock"
                status="OUT_OF_STOCK"
                className="shadow-xs backdrop-blur-xs"
              />
            </div>
          )}
        </div>

        <div className="space-y-2.5 p-2.5 pb-2 min-[390px]:p-3.5 min-[390px]:pb-2.5 sm:space-y-3 sm:p-4 sm:pb-3">
          <div className="space-y-0.5">
            <h3 className="text-foreground line-clamp-2 min-h-[2.6em] break-words text-[15px] leading-snug font-semibold sm:text-[16px]">
              {name(vegetable)}
            </h3>
            {subtitle(vegetable) && (
              <p className="text-brand-muted line-clamp-1 break-words text-[13px] leading-snug font-medium">
                {subtitle(vegetable)}
              </p>
            )}
          </div>

          {/* Ascending label-only size chips with subtle default dot */}
          <div
            className="flex flex-wrap gap-1.5"
            role="radiogroup"
            aria-label={t('shop.chooseSize')}
          >
            {sortedOptions.map((opt) => {
              const active = selectedUnit?.unitId === opt.unitId
              const optExceedsTotalStock =
                availableStockDec !== null && dec(opt.quantityInBaseUnit).gt(availableStockDec)
              return (
                <button
                  key={opt.unitId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={optExceedsTotalStock}
                  onClick={() => setSelectedUnitId(opt.unitId)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[13px] leading-snug font-semibold whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-45 ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary/60 text-secondary-foreground hover:bg-secondary'
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
      <div className="border-border/80 flex flex-wrap items-center justify-between gap-2 border-t px-2.5 py-2.5 min-[390px]:px-3.5 min-[390px]:py-3 sm:px-4">
        <div className="min-w-0">
          <PriceTag
            price={selectedUnit?.price ?? vegetable.pricePerUnit}
            unitLabel={selectedUnit?.label ?? unitLabel}
            size="lg"
            className="[&>span:first-child]:text-[18px] sm:[&>span:first-child]:text-[19px]"
          />
        </div>

        {!vegetable.inStock || !hasPrice ? (
          <StatusBadge kind="stock" status="OUT_OF_STOCK" />
        ) : inCart ? (
          <div className="border-primary/20 bg-accent flex min-h-11 shrink-0 items-center justify-between rounded-[10px] border px-0.5 sm:w-[120px]" aria-live="polite">
            <button
              type="button"
              onClick={() =>
                updateCount(String(vegetable.id), String(selectedUnit!.unitId), inCart.count - 1)
              }
              aria-label={t('common.decrease', { defaultValue: 'Decrease' })}
              className="text-primary hover:bg-card inline-flex size-11 items-center justify-center rounded-[8px] transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:transform-none sm:size-10"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="money-num text-foreground w-6 text-center text-sm font-bold">{inCart.count}</span>
            <button
              type="button"
              disabled={!canAddSelected}
              onClick={() => {
                if (canAddSelected) {
                  updateCount(String(vegetable.id), String(selectedUnit!.unitId), inCart.count + 1)
                }
              }}
              aria-label={t('common.increase', { defaultValue: 'Increase' })}
              className="bg-primary text-primary-foreground hover:bg-deep-green inline-flex size-11 items-center justify-center rounded-[8px] transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-45 sm:size-10"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            disabled={!canAddSelected}
            onClick={handleAdd}
            className="bg-primary hover:bg-deep-green min-h-11 shrink-0 rounded-[10px] px-3.5 text-[13px] font-semibold transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none sm:h-10 sm:min-h-10 sm:px-4 sm:text-[14px]"
          >
            <ShoppingBasket className="size-4 shrink-0" aria-hidden />
            <span>{t('shop.addToCart')}</span>
          </Button>
        )}
      </div>
    </Card>
  )
}
