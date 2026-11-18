import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface MoneyDisplayProps {
  value: string | number
  className?: string
}

/** Displays a rupee value from the server (never estimated). */
export function MoneyDisplay({ value, className }: MoneyDisplayProps) {
  return <span className={cn('money-num', className)}>{formatMoney(value)}</span>
}

/** Displays an estimated rupee amount with the "Estimated" label. */
export function EstimatedAmount({
  value,
  className,
}: MoneyDisplayProps) {
  const { t } = useTranslation()
  return (
    <span className={cn('money-num inline-flex items-center gap-1', className)}>
      <span>{formatMoney(value)}</span>
      <span className="text-muted-foreground text-xs font-normal">({t('common.estimated')})</span>
    </span>
  )
}
