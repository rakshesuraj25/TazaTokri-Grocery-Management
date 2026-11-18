import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Ban,
  Check,
  Clock,
  PackageCheck,
  Tag,
  Truck,
  XCircle,
} from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { OrderStatus } from '@/features/orders/types'
import { cn } from '@/lib/utils'

export type StockBadgeStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
export type PriceBadgeStatus = 'SET' | 'NOT_SET' | 'STALE'

export type StatusBadgeProps =
  | {
      kind: 'stock'
      status: StockBadgeStatus
      label?: string
      className?: string
    }
  | {
      kind: 'price'
      status: PriceBadgeStatus
      label?: string
      className?: string
    }
  | {
      kind: 'order'
      status: OrderStatus
      label?: string
      className?: string
    }

interface StatusStyle {
  variant: BadgeProps['variant']
  translationKey: string
  icon: ReactNode
  extraClass?: string
}

const STOCK_STATUS_MAP: Record<StockBadgeStatus, StatusStyle> = {
  IN_STOCK: {
    variant: 'secondary',
    translationKey: 'common.inStock',
    icon: <Check className="size-3 shrink-0" aria-hidden />,
  },
  LOW_STOCK: {
    variant: 'warning',
    translationKey: 'staff.stock.lowStock',
    icon: <AlertTriangle className="size-3 shrink-0" aria-hidden />,
  },
  OUT_OF_STOCK: {
    variant: 'destructive',
    translationKey: 'common.outOfStock',
    icon: <XCircle className="size-3 shrink-0" aria-hidden />,
  },
}

const PRICE_STATUS_MAP: Record<PriceBadgeStatus, StatusStyle> = {
  SET: {
    variant: 'secondary',
    translationKey: 'pricing.priceSet',
    icon: <Check className="size-3 shrink-0" aria-hidden />,
  },
  NOT_SET: {
    variant: 'warning',
    translationKey: 'pricing.priceNotSet',
    icon: <Tag className="size-3 shrink-0" aria-hidden />,
  },
  STALE: {
    variant: 'outline',
    translationKey: 'pricing.priceStale',
    icon: <Clock className="size-3 shrink-0" aria-hidden />,
  },
}

const ORDER_STATUS_MAP: Record<OrderStatus, StatusStyle> = {
  PENDING_PAYMENT: {
    variant: 'warning',
    translationKey: 'orders.status.PENDING_PAYMENT',
    icon: <Clock className="size-3 shrink-0" aria-hidden />,
  },
  PLACED: {
    variant: 'outline',
    translationKey: 'orders.status.PLACED',
    icon: <Tag className="size-3 shrink-0" aria-hidden />,
  },
  CONFIRMED: {
    variant: 'secondary',
    translationKey: 'orders.status.CONFIRMED',
    icon: <Check className="size-3 shrink-0" aria-hidden />,
  },
  PACKED: {
    variant: 'secondary',
    translationKey: 'orders.status.PACKED',
    icon: <PackageCheck className="size-3 shrink-0" aria-hidden />,
  },
  OUT_FOR_DELIVERY: {
    variant: 'default',
    translationKey: 'orders.status.OUT_FOR_DELIVERY',
    icon: <Truck className="size-3 shrink-0" aria-hidden />,
  },
  DELIVERED: {
    variant: 'success',
    translationKey: 'orders.status.DELIVERED',
    icon: <Check className="size-3 shrink-0" aria-hidden />,
  },
  CANCELLED: {
    variant: 'destructive',
    translationKey: 'orders.status.CANCELLED',
    icon: <Ban className="size-3 shrink-0" aria-hidden />,
  },
}

/**
 * Uniform semantic status pill for stock levels, pricing readiness, and order lifecycle.
 * Always combines an icon with text so meaning never depends on colour alone.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { t } = useTranslation()

  const config =
    props.kind === 'stock'
      ? STOCK_STATUS_MAP[props.status]
      : props.kind === 'price'
        ? PRICE_STATUS_MAP[props.status]
        : ORDER_STATUS_MAP[props.status]

  return (
    <Badge
      variant={config.variant}
      data-testid="status-badge"
      data-kind={props.kind}
      data-status={props.status}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap', config.extraClass, props.className)}
    >
      {config.icon}
      <span>{props.label ?? t(config.translationKey)}</span>
    </Badge>
  )
}
