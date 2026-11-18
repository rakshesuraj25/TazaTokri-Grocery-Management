import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export interface PriceTagProps {
  /** Authoritative server price; null/undefined renders "Price not set" instead of ₹0 */
  price: string | number | null | undefined
  unitLabel?: string | null
  estimated?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_STYLES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
}

export function PriceTag({
  price,
  unitLabel,
  estimated = false,
  size = 'md',
  className,
}: PriceTagProps) {
  const { t } = useTranslation()

  const hasPrice =
    price !== null &&
    price !== undefined &&
    price !== '' &&
    !Number.isNaN(Number(price))

  if (!hasPrice) {
    return (
      <span
        data-testid="price-tag-missing"
        className={cn(
          'bg-turmeric-light text-turmeric-foreground inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
          className
        )}
      >
        {t('pricing.priceNotSet')}
      </span>
    )
  }

  return (
    <span
      data-testid="price-tag"
      className={cn('inline-flex flex-wrap items-baseline gap-1', className)}
    >
      <span className={cn('money-num font-display text-foreground font-extrabold', SIZE_STYLES[size])}>
        {formatMoney(price)}
      </span>
      {unitLabel && (
        <span className="text-muted-foreground text-xs font-medium">/ {unitLabel}</span>
      )}
      {estimated && (
        <span className="text-muted-foreground text-xs font-normal">
          ({t('common.estimated')})
        </span>
      )}
    </span>
  )
}
