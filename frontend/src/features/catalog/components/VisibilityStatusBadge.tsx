import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, EyeOff, Tag, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ProductVisibilityStatus } from '../visibility'

interface VisibilityStatusBlockProps {
  visibility: ProductVisibilityStatus
  editTo?: string
  onQuickPrice?: () => void
  onQuickEnableAvailable?: () => void
  compact?: boolean
}

export function VisibilityStatusBlock({
  visibility,
  editTo,
  onQuickPrice,
  onQuickEnableAvailable,
  compact = false,
}: VisibilityStatusBlockProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={visibility.badgeVariant} className="inline-flex items-center gap-1 whitespace-nowrap">
          {visibility.code === 'PUBLISHED' ? (
            <CheckCircle2 className="size-3 shrink-0" aria-hidden />
          ) : visibility.code === 'HIDDEN_STOCKED' ? (
            <AlertTriangle className="size-3 shrink-0" aria-hidden />
          ) : (
            <EyeOff className="size-3 shrink-0" aria-hidden />
          )}
          <span>{visibility.label}</span>
        </Badge>

        {visibility.code === 'HIDDEN_STOCKED' &&
          visibility.reasons.map((reason) => (
            <span
              key={reason}
              className="bg-turmeric-light text-turmeric-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
            >
              {reason}
            </span>
          ))}
      </div>

      {!compact && (visibility.code === 'HIDDEN_STOCKED' || onQuickPrice || editTo) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {onQuickPrice && (
            <Button
              type="button"
              variant={visibility.missingPrice ? 'default' : 'outline'}
              size="sm"
              onClick={onQuickPrice}
              className="h-7 rounded-full px-2.5 text-xs"
            >
              <Tag className="size-3" aria-hidden />
              {visibility.missingPrice ? 'Set price' : 'Update price'}
            </Button>
          )}

          {visibility.hasStock && visibility.notAvailableToday && visibility.code !== 'INACTIVE' && onQuickEnableAvailable && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onQuickEnableAvailable}
              className="h-7 rounded-full px-2.5 text-xs"
            >
              <Zap className="size-3" aria-hidden />
              Enable Available Today
            </Button>
          )}

          {editTo && (
            <Button asChild variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-xs">
              <Link to={editTo}>Edit</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
