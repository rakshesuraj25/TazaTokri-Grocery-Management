import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { WeaveDivider } from '@/components/WeaveDivider'
import { cn } from '@/lib/utils'

export interface PageBreadcrumb {
  label: string
  to?: string
}

export interface PageHeaderProps {
  title: string
  subtitle?: string
  count?: number
  breadcrumbs?: PageBreadcrumb[]
  serif?: boolean
  weave?: boolean
  actions?: ReactNode
  className?: string
}

/**
 * Unified top header primitive across Customer, Staff, Owner, and Delivery pages.
 */
export function PageHeader({
  title,
  subtitle,
  count,
  breadcrumbs,
  serif = false,
  weave = false,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs font-medium">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1
            return (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
                {crumb.to && !isLast ? (
                  <Link to={crumb.to} className="hover:text-primary transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'text-foreground font-semibold' : undefined}>{crumb.label}</span>
                )}
              </span>
            )
          })}
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className={cn(
                'text-foreground text-2xl leading-tight font-bold tracking-tight sm:text-3xl',
                serif ? 'font-organic' : 'font-display font-extrabold',
              )}
            >
              {title}
            </h1>
            {typeof count === 'number' && (
              <Badge variant="secondary" className="money-num rounded-full">
                {count}
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-muted-foreground text-sm leading-relaxed">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {weave && <WeaveDivider />}
    </header>
  )
}
