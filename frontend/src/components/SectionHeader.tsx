import type { ReactNode } from 'react'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { WeaveDivider } from '@/components/WeaveDivider'
import { cn } from '@/lib/utils'

export interface SectionHeaderProps {
  title: string
  category?: string | null
  subtitle?: string
  count?: number
  action?: ReactNode
  weave?: boolean
  className?: string
}

/**
 * Category-accented section heading with left colour bar (green, turmeric, soil, or neutral).
 */
export function SectionHeader({
  title,
  category,
  subtitle,
  count,
  action,
  weave = false,
  className,
}: SectionHeaderProps) {
  const theme = getCategoryTheme(category)

  return (
    <div
      data-testid="section-header"
      data-category-tone={theme.tone}
      className={cn('space-y-2', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn('h-7 w-1.5 shrink-0 rounded-full', theme.barClass)}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-foreground truncate text-lg font-extrabold tracking-tight sm:text-xl">
                {title}
              </h2>
              {typeof count === 'number' && (
                <span
                  className={cn(
                    'money-num inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                    theme.washClass,
                    theme.textClass
                  )}
                >
                  {count}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-muted-foreground truncate text-xs sm:text-sm">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {weave && <WeaveDivider />}
    </div>
  )
}
