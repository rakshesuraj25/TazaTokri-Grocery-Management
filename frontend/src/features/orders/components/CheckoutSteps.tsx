import { useTranslation } from 'react-i18next'
import { Banknote, CheckCircle2, CreditCard, MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EstimatedAmount, MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import type { CartItem } from '@/features/cart/types'
import type { CustomerAddress } from '@/features/users/types'
import {
  FREE_DELIVERY_THRESHOLD,
  MIN_ORDER_AMOUNT,
  isMinimumOrderMet,
  isSameDayDeliveryIST,
} from '@/lib/businessRules'
import { formatMoney, mulMoney, subMoney } from '@/lib/money'
import type Decimal from 'decimal.js'
import type { OrderPaymentMethod } from '../types'

export type CheckoutStep = 1 | 2 | 3

export function CheckoutStepBar({
  step,
  onSelectStep,
}: {
  step: CheckoutStep
  onSelectStep: (step: CheckoutStep) => void
}) {
  const { t } = useTranslation()
  const steps: { id: CheckoutStep; label: string }[] = [
    { id: 1, label: t('checkout.deliveryAddress') },
    { id: 2, label: t('checkout.paymentMethod') },
    { id: 3, label: t('checkout.orderSummary') },
  ]

  return (
    <ol className="grid grid-cols-3 gap-2" aria-label={t('checkout.title')}>
      {steps.map((s) => {
        const active = step === s.id
        const done = step > s.id
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelectStep(s.id)}
              className={`touch-target flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                active
                  ? 'border-primary bg-secondary text-primary'
                  : done
                    ? 'border-primary/40 bg-card text-foreground'
                    : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {done ? (
                <CheckCircle2 className="text-primary size-4 shrink-0" aria-hidden />
              ) : (
                <span className="bg-primary/15 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                  {s.id}
                </span>
              )}
              <span className="truncate">{s.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function CheckoutAddressStep({
  activeStep,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onAddAddress,
}: {
  activeStep: boolean
  addresses: CustomerAddress[]
  selectedAddressId: string
  onSelectAddress: (id: string) => void
  onAddAddress: () => void
}) {
  const { t } = useTranslation()

  return (
    <Card className={`space-y-3 p-4 sm:p-5 ${activeStep ? 'ring-primary/25 ring-2' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display flex items-center gap-1.5 text-base font-bold">
          <MapPin className="text-primary size-4" aria-hidden />
          1. {t('checkout.deliveryAddress')}
        </h2>
        <Button variant="outline" size="sm" onClick={onAddAddress} className="rounded-full">
          <Plus className="size-4" aria-hidden />
          {t('checkout.addAddress')}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('checkout.addAddress')}</p>
      ) : (
        <div className="space-y-2" role="radiogroup" aria-label={t('checkout.deliveryAddress')}>
          {addresses.map((addr) => {
            const active = selectedAddressId === String(addr.id)
            return (
              <button
                key={String(addr.id)}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelectAddress(String(addr.id))}
                className={`flex w-full items-start justify-between rounded-2xl border p-3.5 text-left text-sm transition-colors ${
                  active ? 'border-primary bg-secondary/50 ring-primary ring-1' : 'bg-card hover:bg-secondary/25'
                }`}
              >
                <div>
                  <p className="font-display font-bold">{addr.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''} — {addr.pincode}
                  </p>
                </div>
                {addr.defaultAddress && <Badge variant="secondary">Default</Badge>}
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export function CheckoutPaymentStep({
  activeStep,
  paymentMethod,
  onlineDisabled,
  onSelectMethod,
}: {
  activeStep: boolean
  paymentMethod: OrderPaymentMethod
  onlineDisabled: boolean
  onSelectMethod: (method: OrderPaymentMethod) => void
}) {
  const { t } = useTranslation()

  return (
    <Card className={`space-y-3 p-4 sm:p-5 ${activeStep ? 'ring-primary/25 ring-2' : ''}`}>
      <h2 className="font-display text-base font-bold">2. {t('checkout.paymentMethod')}</h2>
      <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={t('checkout.paymentMethod')}>
        <button
          type="button"
          role="radio"
          aria-checked={paymentMethod === 'COD'}
          onClick={() => onSelectMethod('COD')}
          className={`touch-target flex items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-bold transition-colors ${
            paymentMethod === 'COD'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'bg-card text-foreground hover:bg-secondary/35'
          }`}
        >
          <Banknote className="size-4" aria-hidden />
          {t('checkout.cod')}
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={paymentMethod === 'ONLINE'}
          disabled={onlineDisabled}
          onClick={() => onSelectMethod('ONLINE')}
          className={`touch-target flex items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            paymentMethod === 'ONLINE'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'bg-card text-foreground hover:bg-secondary/35'
          }`}
        >
          <CreditCard className="size-4" aria-hidden />
          {t('checkout.online')}
        </button>
      </div>
      {onlineDisabled && (
        <p
          role="status"
          className="text-turmeric-foreground bg-turmeric-light rounded-xl px-3.5 py-2.5 text-xs font-medium"
        >
          {t('checkout.onlineUnavailableNow', {
            defaultValue: 'Online payment is not available right now',
          })}
        </p>
      )}
    </Card>
  )
}

export function CheckoutSummaryCard({
  activeStep,
  items,
  subtotal,
  deliveryFee,
  estimatedTotal,
  canPlace,
  isPending,
  onPlaceOrder,
}: {
  activeStep: boolean
  items: CartItem[]
  subtotal: Decimal
  deliveryFee: Decimal
  estimatedTotal: Decimal
  canPlace: boolean
  isPending: boolean
  onPlaceOrder: () => void
}) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const isSameDay = isSameDayDeliveryIST()

  return (
    <Card className={`space-y-3 p-4 sm:p-5 ${activeStep ? 'ring-primary/25 ring-2' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">3. {t('checkout.orderSummary')}</h2>
        <Badge variant="secondary">
          {t('checkout.deliveryDate')}:{' '}
          {isSameDay ? t('checkout.deliveryToday') : t('checkout.deliveryTomorrow')}
        </Badge>
      </div>

      <p className="text-muted-foreground text-xs">
        {isSameDay ? t('shop.cutoffBefore') : t('shop.cutoffAfter')}
      </p>

      {!isMinimumOrderMet(subtotal) && (
        <p className="text-warning text-xs font-medium">
          {t('shop.minOrderHint', {
            amount: formatMoney(subMoney(MIN_ORDER_AMOUNT, subtotal)),
          })}
        </p>
      )}

      {isMinimumOrderMet(subtotal) && subtotal.lt(FREE_DELIVERY_THRESHOLD) && (
        <p className="text-muted-foreground text-xs">
          {t('shop.freeDeliveryHint', {
            amount: formatMoney(subMoney(FREE_DELIVERY_THRESHOLD, subtotal)),
          })}
        </p>
      )}

      <ul className="divide-border divide-y text-sm">
        {items.map((i) => (
          <li
            key={`${i.vegetableId}-${i.unitId}`}
            className="flex items-center justify-between gap-2.5 py-2"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <VegetableImage nameEn={i.nameEn} alt={name(i)} size="xs" />
              <span className="truncate">
                {name(i)} ({i.unitLabel}) × {i.count}
              </span>
            </div>
            <MoneyDisplay value={mulMoney(i.pricePerUnit, i.count).toFixed(2)} />
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t pt-2 text-sm" aria-live="polite">
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

      <Button
        size="xl"
        className="w-full rounded-2xl"
        disabled={!canPlace}
        loading={isPending}
        onClick={onPlaceOrder}
      >
        {t('checkout.placeOrder')}
      </Button>
    </Card>
  )
}
