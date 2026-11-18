import { useTranslation } from 'react-i18next'
import { Banknote, Calculator, Minus, Plus, QrCode, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EstimatedAmount, MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { addMoney, dec, formatQty, mulMoney, sumMoney, toApiQty } from '@/lib/money'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { buildUpiString } from '../quickSaleHelpers'
import type { SalePaymentMethod } from '../types'

export interface BillLine {
  item: StaffCatalogItem
  /** Base-unit quantity string (up to 3 decimals) */
  quantity: string
}

interface QuickSaleBillProps {
  lines: BillLine[]
  paymentMethod: SalePaymentMethod
  onPaymentMethodChange: (method: SalePaymentMethod) => void
  onChangeQuantity: (vegId: string | number, nextQty: string) => void
  onOpenKeypad?: (item: StaffCatalogItem, currentQty: string) => void
  onRemoveLine: (vegId: string | number) => void
  onClear: () => void
  onSubmit: () => void
  isSubmitting: boolean
  errorMessage?: string | null
}

export function QuickSaleBill({
  lines,
  paymentMethod,
  onPaymentMethodChange,
  onChangeQuantity,
  onOpenKeypad,
  onRemoveLine,
  onClear,
  onSubmit,
  isSubmitting,
  errorMessage,
}: QuickSaleBillProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()

  // Display-only estimate (server prices the real sale on submit)
  const estimatedTotal = sumMoney(
    lines.map((l) => mulMoney(l.item.pricePerUnit ?? 0, l.quantity)),
  )
  const hasInvalidQty = lines.some((l) => !dec(l.quantity).gt(0))
  const hasOverStock = lines.some((l) => dec(l.quantity).gt(dec(l.item.stock)))
  const canSubmit = lines.length > 0 && !hasInvalidQty && !hasOverStock && !isSubmitting

  const stepQty = (line: BillLine, delta: number) => {
    const step = line.item.baseUnit === 'KG' ? 0.25 : 1
    const next = addMoney(line.quantity, delta * step)
    if (next.lte(0)) {
      onRemoveLine(line.item.id)
    } else {
      onChangeQuantity(line.item.id, toApiQty(next))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">
          {t('staff.sale.cart')} ({lines.length})
        </h2>
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} disabled={isSubmitting}>
            <Trash2 className="size-4" />
            {t('staff.sale.clearBill')}
          </Button>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-tomato-light text-tomato rounded-lg p-3 text-sm font-medium"
        >
          {errorMessage}
        </div>
      )}

      {lines.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          {t('staff.sale.tapToAdd')}
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-xl border">
          {lines.map((line) => {
            const unitLabel = t(`units.${line.item.baseUnit}`, {
              defaultValue: line.item.baseUnit,
            })
            const lineEst = mulMoney(line.item.pricePerUnit ?? 0, line.quantity)
            const overStock = dec(line.quantity).gt(dec(line.item.stock))

            return (
              <li
                key={String(line.item.id)}
                className={`flex flex-col gap-2 p-3 ${overStock ? 'bg-destructive/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <VegetableImage
                      nameEn={line.item.nameEn}
                      imageUrl={line.item.imageUrl}
                      category={line.item.category}
                      alt={name(line.item)}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <p className="font-display break-words text-sm leading-snug font-bold">
                        {name(line.item)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        <MoneyDisplay value={line.item.pricePerUnit ?? 0} /> / {unitLabel}
                      </p>
                    </div>
                  </div>
                  <EstimatedAmount
                    value={lineEst.toFixed(2)}
                    className="font-display shrink-0 text-sm font-bold"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => stepQty(line, -1)}
                      aria-label="Decrease quantity"
                      className="touch-target bg-secondary text-secondary-foreground inline-flex items-center justify-center rounded-lg"
                    >
                      <Minus className="size-4" />
                    </button>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step={line.item.baseUnit === 'KG' ? '0.05' : '1'}
                      min="0.001"
                      value={line.quantity}
                      aria-label={`${name(line.item)} ${t('staff.sale.quantity')}`}
                      onChange={(e) => onChangeQuantity(line.item.id, e.target.value)}
                      className="h-11 w-24 text-center font-mono text-sm"
                    />
                    <span className="text-muted-foreground text-xs font-medium">{unitLabel}</span>
                    <button
                      type="button"
                      onClick={() => stepQty(line, 1)}
                      aria-label="Increase quantity"
                      className="touch-target bg-secondary text-secondary-foreground inline-flex items-center justify-center rounded-lg"
                    >
                      <Plus className="size-4" />
                    </button>
                    {onOpenKeypad && (
                      <button
                        type="button"
                        onClick={() => onOpenKeypad(line.item, line.quantity)}
                        aria-label={t('staff.sale.exactWeight', { defaultValue: 'Exact weight keypad' })}
                        className="touch-target bg-secondary text-secondary-foreground inline-flex items-center justify-center rounded-lg"
                      >
                        <Calculator className="size-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveLine(line.item.id)}
                    aria-label={t('common.delete')}
                    className="touch-target text-muted-foreground hover:text-destructive inline-flex items-center justify-center rounded-lg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {overStock && (
                  <p className="text-destructive text-xs font-medium" role="alert">
                    {t('staff.sale.exceedsStock', {
                      stock: formatQty(line.item.stock),
                      unit: unitLabel,
                    })}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Payment method selector */}
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('staff.sale.paymentMethod')}>
        {(['CASH', 'UPI'] as const).map((method) => {
          const active = paymentMethod === method
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPaymentMethodChange(method)}
              className={`touch-target flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card text-foreground hover:bg-secondary'
              }`}
            >
              {method === 'CASH' ? <Banknote className="size-4" /> : <QrCode className="size-4" />}
              {method === 'CASH' ? t('staff.sale.cash') : t('staff.sale.upi')}
            </button>
          )
        })}
      </div>

      {paymentMethod === 'UPI' && (
        <div className="bg-secondary/50 space-y-1 rounded-xl border p-3 text-xs">
          <p className="font-semibold">
            {t('staff.sale.upiScanNotice', {
              defaultValue: 'Customer scans, then staff confirm payment received',
            })}
          </p>
          {import.meta.env.VITE_SHOP_UPI_ID ? (
            <>
              <p className="font-mono text-xs break-all">
                UPI ID: {import.meta.env.VITE_SHOP_UPI_ID}
              </p>
              <p className="text-muted-foreground font-mono text-[11px] break-all">
                {buildUpiString({
                  upiId: import.meta.env.VITE_SHOP_UPI_ID,
                  payeeName: 'TazaTokri',
                  amount: estimatedTotal.toFixed(2),
                })}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              {t('staff.sale.upiIdNotConfigured', {
                defaultValue: 'Set VITE_SHOP_UPI_ID to show store UPI payment details.',
              })}
            </p>
          )}
        </div>
      )}

      {/* Live estimated total + submit */}
      <div
        aria-live="polite"
        className="bg-secondary/60 flex items-center justify-between rounded-xl px-4 py-3"
      >
        <span className="text-sm font-semibold">{t('staff.sale.totalEstimate')}</span>
        <EstimatedAmount
          value={estimatedTotal.toFixed(2)}
          className="font-display text-primary text-xl font-extrabold"
        />
      </div>

      <Button
        type="button"
        size="xl"
        className="w-full"
        disabled={!canSubmit}
        loading={isSubmitting}
        onClick={onSubmit}
      >
        {isSubmitting
          ? t('common.saving', { defaultValue: 'Saving...' })
          : t('staff.sale.saveSale')}
      </Button>
      {hasOverStock && lines.length > 0 && (
        <p className="text-destructive text-center text-xs font-medium">
          {t('staff.sale.reduceOverStock', {
            defaultValue: 'Reduce quantities above available stock to save sale.',
          })}
        </p>
      )}
    </div>
  )
}
