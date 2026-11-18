import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatTone = 'neutral' | 'positive' | 'warning' | 'danger'

const TONE_ACCENT: Record<StatTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-primary',
  warning: 'text-turmeric-foreground',
  danger: 'text-tomato',
}

const ICON_BG: Record<StatTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  positive: 'bg-secondary text-primary',
  warning: 'bg-turmeric-light text-turmeric-foreground',
  danger: 'bg-tomato-light text-tomato',
}

export interface StatProps {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  tone?: StatTone
  active?: boolean
  onClick?: () => void
  className?: string
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  active = false,
  onClick,
  className,
}: StatProps) {
  const sharedClassName = cn(
    'bg-card text-card-foreground border-border flex w-full items-start justify-between gap-3 rounded-2xl border p-4 text-left shadow-xs transition-all duration-150',
    onClick && 'hover:border-primary/45 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active && 'border-primary bg-sage/35 ring-2 ring-primary/20',
    className,
  )

  const content = (
    <>
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className={cn('money-num font-display text-2xl leading-none font-extrabold', TONE_ACCENT[tone])}>
          {value}
        </p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      {icon && (
        <div
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            ICON_BG[tone],
          )}
        >
          {icon}
        </div>
      )}
    </>
  )

  if (onClick) {
    return (
      <button type="button" data-testid="stat-card" onClick={onClick} aria-pressed={active} className={sharedClassName}>
        {content}
      </button>
    )
  }

  return (
    <div data-testid="stat-card" className={sharedClassName}>
      {content}
    </div>
  )
}
