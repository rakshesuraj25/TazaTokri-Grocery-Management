import { useTranslation } from 'react-i18next'
import { formatQty } from '@/lib/money'
import { cn } from '@/lib/utils'

export interface StockMeterProps {
  /** Current stock quantity in base unit */
  quantity: string | number
  /** Full/target threshold used to scale the bar width (defaults to 25) */
  max?: number
  /** Threshold at or below which stock is highlighted as low (defaults to 5) */
  lowThreshold?: number
  unitLabel?: string
  showLabel?: boolean
  className?: string
}

export function StockMeter({
  quantity,
  max = 25,
  lowThreshold = 5,
  unitLabel,
  showLabel = true,
  className,
}: StockMeterProps) {
  const { t } = useTranslation()
  const numeric = Number(quantity)
  const safeQty = Number.isFinite(numeric) && numeric > 0 ? numeric : 0
  const safeMax = max > 0 ? max : 25
  const pct = Math.min(100, Math.round((safeQty / safeMax) * 100))

  const state =
    safeQty <= 0 ? 'out' : safeQty <= lowThreshold ? 'low' : 'ok'

  const barColour =
    state === 'out'
      ? 'bg-tomato'
      : state === 'low'
        ? 'bg-turmeric'
        : 'bg-primary'

  const textColour =
    state === 'out'
      ? 'text-tomato'
      : state === 'low'
        ? 'text-turmeric-foreground'
        : 'text-primary'

  const stateText =
    state === 'out'
      ? t('common.outOfStock')
      : state === 'low'
        ? t('staff.stock.lowStock')
        : t('common.inStock')

  return (
    <div className={cn('space-y-1.5', className)} data-testid="stock-meter" data-stock-state={state}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="money-num text-foreground font-semibold">
          {formatQty(quantity)}
          {unitLabel ? ` ${unitLabel}` : ''}
        </span>
        {showLabel && (
          <span className={cn('font-medium', textColour)}>{stateText}</span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.min(safeQty, safeMax)}
        aria-label={`${formatQty(quantity)}${unitLabel ? ` ${unitLabel}` : ''} — ${stateText}`}
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColour)}
          style={{ width: `${safeQty > 0 ? Math.max(pct, 6) : 0}%` }}
        />
      </div>
    </div>
  )
}
