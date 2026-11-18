import { useTranslation } from 'react-i18next'
import { Minus, Package, Plus, ShoppingBasket, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { SectionHeader } from '@/components/SectionHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { useCartStore } from '@/features/cart/store'
import type { PublicVegetable } from '@/features/catalog/types'
import { dec, formatMoney } from '@/lib/money'
import type { ComboDto } from '../types'

interface ShopCombosSectionProps {
  combos: ComboDto[]
  usualVegetables?: PublicVegetable[]
}

export function ShopCombosSection({
  combos,
  usualVegetables = [],
}: ShopCombosSectionProps) {
  const { t, i18n } = useTranslation()
  const { name } = useVegetableName()
  const cartCombos = useCartStore((s) => s.combos)
  const addCombo = useCartStore((s) => s.addCombo)
  const updateComboCount = useCartStore((s) => s.updateComboCount)

  if (combos.length === 0) return null

  const usualIdSet = new Set(usualVegetables.map((v) => String(v.id)))

  const getComboDescription = (combo: ComboDto): string | null => {
    if (i18n.language === 'mr' && combo.descriptionMr) return combo.descriptionMr
    if (i18n.language === 'hi' && combo.descriptionHi) return combo.descriptionHi
    return combo.descriptionEn ?? null
  }

  return (
    <section className="space-y-3" data-testid="shop-combos-section">
      <SectionHeader
        title={t('combos.sectionTitle', { defaultValue: 'Value Combo Packs' })}
        count={combos.length}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {combos.map((combo) => {
          const inCart = cartCombos.find((c) => String(c.comboId) === String(combo.id))
          const isRecommended =
            usualIdSet.size > 0 &&
            combo.items.some((item) => usualIdSet.has(String(item.vegetableId)))
          const hasSavings = dec(combo.savingsAmount).gt(0)
          const contentsSummary = combo.items
            .map((item) => `${name(item)} (${item.unitLabel})`)
            .join(', ')
          const maxCap =
            combo.maxAvailableCombos > 0 ? Math.min(combo.maxAvailableCombos, 10) : 0
          const canAddMore = combo.inStock && (inCart?.count ?? 0) < maxCap
          const desc = getComboDescription(combo)

          return (
            <Card
              key={String(combo.id)}
              data-testid={`combo-card-${combo.id}`}
              className="border-primary/25 bg-card flex h-full flex-col justify-between gap-3 rounded-2xl p-4 shadow-2xs transition-shadow hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="gap-1 rounded-full">
                      <Package className="size-3.5" aria-hidden />
                      {t('combos.itemsCount', {
                        count: combo.items.length,
                        defaultValue: `${combo.items.length} vegetables`,
                      })}
                    </Badge>
                    {isRecommended && (
                      <Badge variant="default" className="gap-1 rounded-full">
                        <Sparkles className="size-3" aria-hidden />
                        {t('combos.recommendedBadge', {
                          defaultValue: 'Matches your usual',
                        })}
                      </Badge>
                    )}
                  </div>

                  {hasSavings && (
                    <Badge variant="warning" className="rounded-full font-bold">
                      {t('combos.saveBadge', {
                        amount: formatMoney(combo.savingsAmount),
                        defaultValue: `Save ${formatMoney(combo.savingsAmount)}`,
                      })}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-organic text-foreground text-lg font-bold">
                    {name(combo)}
                  </h3>
                  {desc && (
                    <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
                  )}
                </div>

                {/* Constituent vegetable thumbnails + unit chips */}
                <div className="bg-surface-subtle/60 flex flex-wrap gap-1.5 rounded-xl p-2.5">
                  {combo.items.map((item) => (
                    <span
                      key={String(item.vegetableId)}
                      className="bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                    >
                      <VegetableImage
                        nameEn={item.nameEn}
                        imageUrl={item.imageUrl}
                        size="xs"
                      />
                      <span>
                        {name(item)} · <strong>{item.unitLabel}</strong>
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-border/70 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <MoneyDisplay
                      value={combo.sellingPrice}
                      className="font-display text-primary text-xl font-extrabold"
                    />
                    {combo.regularCombinedPrice !== null && hasSavings && (
                      <span className="text-muted-foreground money-num text-xs line-through">
                        {formatMoney(combo.regularCombinedPrice)}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {t('combos.comboPriceLabel', { defaultValue: 'Combo pack price' })}
                  </p>
                </div>

                {!combo.inStock ? (
                  <StatusBadge kind="stock" status="OUT_OF_STOCK" />
                ) : inCart ? (
                  <div className="flex items-center gap-1.5" aria-live="polite">
                    <button
                      type="button"
                      onClick={() => updateComboCount(String(combo.id), inCart.count - 1)}
                      aria-label={t('common.decrease', { defaultValue: 'Decrease' })}
                      className="touch-target bg-secondary text-secondary-foreground inline-flex items-center justify-center rounded-full"
                    >
                      <Minus className="size-4" aria-hidden />
                    </button>
                    <span className="money-num w-6 text-center text-sm font-bold">
                      {inCart.count}
                    </span>
                    <button
                      type="button"
                      disabled={!canAddMore}
                      onClick={() => {
                        if (canAddMore) {
                          updateComboCount(String(combo.id), inCart.count + 1)
                        }
                      }}
                      aria-label={t('common.increase', { defaultValue: 'Increase' })}
                      className="touch-target bg-primary text-primary-foreground inline-flex items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Plus className="size-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      addCombo({
                        comboId: String(combo.id),
                        count: 1,
                        nameEn: combo.nameEn,
                        nameMr: combo.nameMr ?? undefined,
                        nameHi: combo.nameHi ?? undefined,
                        sellingPrice: String(combo.sellingPrice),
                        regularCombinedPrice:
                          combo.regularCombinedPrice !== null
                            ? String(combo.regularCombinedPrice)
                            : null,
                        maxAvailableCombos: combo.maxAvailableCombos,
                        contentsSummary,
                      })
                    }
                    className="min-h-11 rounded-full px-4"
                  >
                    <ShoppingBasket className="size-4 shrink-0" aria-hidden />
                    <span>{t('combos.addCombo', { defaultValue: 'Add combo' })}</span>
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
