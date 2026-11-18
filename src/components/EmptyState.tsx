import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WeaveDivider } from '@/components/WeaveDivider'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  /** Custom action element OR provide actionLabel + onAction / actionTo */
  action?: ReactNode
  actionLabel?: string
  onAction?: () => void
  actionTo?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  actionTo,
}: EmptyStateProps) {
  const renderedIcon =
    icon === undefined || typeof icon === 'string' ? (
      <Inbox className="h-8 w-8" aria-hidden />
    ) : (
      icon
    )

  const resolvedAction =
    action ??
    (actionLabel && actionTo ? (
      <Button asChild size="sm">
        <Link to={actionTo}>{actionLabel}</Link>
      </Button>
    ) : actionLabel && onAction ? (
      <Button type="button" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null)

  return (
    <div
      data-testid="empty-state"
      className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <div className="bg-secondary text-primary flex h-16 w-16 items-center justify-center rounded-full">
        {renderedIcon}
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <WeaveDivider className="max-w-[140px]" />
      {description && <p className="text-muted-foreground max-w-xs text-sm">{description}</p>}
      {resolvedAction && <div className="mt-2">{resolvedAction}</div>}
    </div>
  )
}

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({ title, message, onRetry, retryLabel }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      data-testid="error-state"
      className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <div className="bg-tomato-light text-tomato flex h-16 w-16 items-center justify-center rounded-full">
        <AlertTriangle className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="font-display text-lg font-semibold">{title ?? t('common.error')}</h3>
      <p className="text-muted-foreground max-w-xs text-sm">{message ?? t('errors.generic')}</p>
      {onRetry && (
        <Button type="button" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="size-4" aria-hidden />
          {retryLabel ?? t('common.retry')}
        </Button>
      )}
    </div>
  )
}
