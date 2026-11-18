import { useTranslation } from 'react-i18next'
import { AlertCircle, BookmarkPlus, Minus, Package, Plus, ShoppingBasket, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/EmptyState'
import { EstimatedAmount, MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { useCartStore } from '@/features/cart/store'
import {
  FREE_DELIVERY_THRESHOLD,
  MAX_ITEM_COUNT,
  MIN_ORDER_AMOUNT,
  estimateDeliveryFee,
  isMinimumOrderMet,
} from '@/lib/businessRules'
import { addMoney, dec, formatMoney, mulMoney, subMoney, sumMoney } from '@/lib/money'

export interface CartContentsProps {
  onCheckout: () => void
  onSaveAsBasket?: () => void
  prunedNames?: string[]
  onDismissPruned?: () => void
  compactListClassName?: string
}

export function CartContents({
  onCheckout,
  onSaveAsBasket,
  prunedNames = [],
  onDismissPruned,
  compactListClassName = 'max-h-72',
}: CartContentsProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const items = useCartStore((s) => s.items)
  const combos = useCartStore((s) => s.combos)
  const updateCount = useCartStore((s) => s.updateCount)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateComboCount = useCartStore((s) => s.updateComboCount)
  const removeCombo = useCartStore((s) => s.removeCombo)

  const itemsSubtotal = sumMoney(items.map((i) => mulMoney(i.pricePerUnit, i.count)))
  const combosSubtotal = sumMoney(combos.map((c) => mulMoney(c.sellingPrice, c.count)))
  const subtotal = addMoney(itemsSubtotal, combosSubtotal)
  const deliveryFee = estimateDeliveryFee(subtotal)
  const estimatedTotal = addMoney(subtotal, deliveryFee)
  const minProgress = Math.min(100, subtotal.div(MIN_ORDER_AMOUNT).mul(100).toNumber())
  const freeProgress = Math.min(
    100,
    subtotal.div(FREE_DELIVERY_THRESHOLD).mul(100).toNumber(),
  )

  const isEmpty = items.length === 0 && combos.length === 0

  return (
    <div className="space-y-4">
      {prunedNames.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="bg-turmeric-light text-turmeric-foreground flex items-start justify-between gap-2 rounded-xl border border-amber-300/60 p-3 text-xs font-medium"
        >
          <span className="flex items-start gap-1.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t('cart.prunedNotice', {
                items: prunedNames.join(', '),
                defaultValue: `Removed unavailable items: ${prunedNames.join(', ')}`,
              })}
            </span>
          </span>
          {onDismissPruned && (
            <button
              type="button"
              onClick={onDismissPruned}
              className="shrink-0 underline"
            >
              {t('common.close')}
            </button>
          )}
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<ShoppingBasket className="size-8" aria-hidden />}
          title={t('shop.cartEmpty')}
          description={t('shop.cartEmptyHint')}
        />
      ) : (
        <div className="space-y-4">
          <div className="bg-secondary/60 space-y-1.5 rounded-xl p-3 text-xs">
            {subtotal.lt(MIN_ORDER_AMOUNT) ? (
              <>
                <p className="font-semibold">
                  {t('shop.minOrderHint', {
                    amount: formatMoney(subMoney(MIN_ORDER_AMOUNT, subtotal)),
                  })}
                </p>
                <Progress
                  value={minProgress}
                  aria-label={t('shop.minOrderHint', { amount: formatMoney(MIN_ORDER_AMOUNT) })}
                />
              </>
            ) : subtotal.lt(FREE_DELIVERY_THRESHOLD) ? (
              <>
                <p className="font-semibold">
                  {t('shop.freeDeliveryHint', {
                    amount: formatMoney(subMoney(FREE_DELIVERY_THRESHOLD, subtotal)),
                  })}
                </p>
                <Progress value={freeProgress} aria-label={t('shop.freeDeliveryMet')} />
              </>
            ) : (
              <p className="text-primary font-bold">{t('shop.freeDeliveryMet')}</p>
            )}
          </div>

          <ul className={`divide-border divide-y overflow-y-auto rounded-xl border ${compactListClassName}`}>
            {combos.map((combo) => {
              const maxCap =
                combo.maxAvailableCombos && combo.maxAvailableCombos > 0
                  ? Math.min(combo.maxAvailableCombos, 10)
                  : 10
              const cannotIncreaseCombo = combo.count >= maxCap

              return (
                <li
                  key={`combo-${combo.comboId}`}
                  className="bg-secondary/20 flex items-center justify-between gap-2 p-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                        <Package className="mr-0.5 size-3" aria-hidden />
                        {t('combos.badge', { defaultValue: 'Combo' })}
                      </Badge>
                      <p className="font-display truncate text-sm font-bold">{name(combo)}</p>
                    </div>
                    <p className="text-muted-foreground truncate text-[11px]">
                      {combo.contentsSummary}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      <MoneyDisplay value={combo.sellingPrice} /> × {combo.count}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateComboCount(combo.comboId, combo.count - 1)}
                      aria-label={t('common.decrease', { defaultValue: 'Decrease' })}
                      className="touch-target bg-secondary inline-flex items-center justify-center rounded-lg"
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="money-num w-6 text-center text-sm font-bold">
                      {combo.count}
                    </span>
                    <button
                      type="button"
                      disabled={cannotIncreaseCombo}
                      onClick={() => {
                        if (!cannotIncreaseCombo) {
                          updateComboCount(combo.comboId, combo.count + 1)
                        }
                      }}
                      aria-label={t('common.increase', { defaultValue: 'Increase' })}
                      className="touch-target bg-secondary inline-flex items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCombo(combo.comboId)}
                      aria-label={t('common.delete')}
                      className="touch-target text-muted-foreground hover:text-destructive inline-flex items-center justify-center"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}

            {items.map((item) => {
              const totalVegBaseInCart = items
                .filter((i) => i.vegetableId === item.vegetableId)
                .reduce((acc, i) => acc.add(dec(i.quantityInBaseUnit).mul(i.count)), dec(0))
              const hasMaxStock =
                item.availableStock !== undefined &&
                item.availableStock !== null &&
                item.availableStock !== '' &&
                totalVegBaseInCart.add(dec(item.quantityInBaseUnit)).gt(dec(item.availableStock))
              const cannotIncrease = item.count >= MAX_ITEM_COUNT || hasMaxStock

              return (
                <li
                  key={`${item.vegetableId}-${item.unitId}`}
                  className="flex items-center justify-between gap-2 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <VegetableImage nameEn={item.nameEn} alt={name(item)} size="xs" />
                    <div className="min-w-0">
                      <p className="font-display truncate text-sm font-bold">
                        {name(item)} ({item.unitLabel})
                      </p>
                      <p className="text-muted-foreground text-xs">
                        <MoneyDisplay value={item.pricePerUnit} /> × {item.count}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateCount(item.vegetableId, item.unitId, item.count - 1)}
                      aria-label={t('common.decrease', { defaultValue: 'Decrease' })}
                      className="touch-target bg-secondary inline-flex items-center justify-center rounded-lg"
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="money-num w-6 text-center text-sm font-bold">
                      {item.count}
                    </span>
                    <button
                      type="button"
                      disabled={cannotIncrease}
                      onClick={() => {
                        if (!cannotIncrease) {
                          updateCount(item.vegetableId, item.unitId, item.count + 1)
                        }
                      }}
                      aria-label={t('common.increase', { defaultValue: 'Increase' })}
                      className="touch-target bg-secondary inline-flex items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.vegetableId, item.unitId)}
                      aria-label={t('common.delete')}
                      className="touch-target text-muted-foreground hover:text-destructive inline-flex items-center justify-center"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="space-y-1 text-sm" aria-live="polite">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('cart.subtotal')}</span>
              <EstimatedAmount value={subtotal.toFixed(2)} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('cart.deliveryFee')}</span>
              <EstimatedAmount value={deliveryFee.toFixed(2)} />
            </div>
            <div className="flex justify-between border-t pt-2 font-bold">
              <span>{t('cart.estimatedTotal')}</span>
              <EstimatedAmount
                value={estimatedTotal.toFixed(2)}
                className="font-display text-primary text-lg font-extrabold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Button
              size="xl"
              className="w-full"
              disabled={!isMinimumOrderMet(subtotal)}
              onClick={onCheckout}
            >
              {t('cart.proceedToCheckout')}
            </Button>

            {onSaveAsBasket && items.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full rounded-xl"
                onClick={onSaveAsBasket}
              >
                <BookmarkPlus className="size-4" aria-hidden />
                {t('baskets.saveCurrentBasket', { defaultValue: 'Save as recurring basket' })}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
