import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-testid="card-skeleton"
      aria-hidden
      className={cn(
        'bg-card border-border space-y-3 rounded-xl border p-3.5 shadow-xs',
        className
      )}
    >
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3.5 w-1/2 rounded-md" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      data-testid="product-grid-skeleton"
      aria-busy="true"
      className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ListSkeleton({
  rows = 4,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div
      data-testid="list-skeleton"
      aria-busy="true"
      className={cn('space-y-2.5', className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-card border-border flex items-center gap-3 rounded-xl border p-3"
        >
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="h-3 w-1/3 rounded-md" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function StatGridSkeleton({
  count = 3,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      data-testid="stat-grid-skeleton"
      aria-busy="true"
      className={cn('grid gap-3 sm:grid-cols-3', className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card border-border flex items-start justify-between rounded-xl border p-4"
        >
          <div className="w-2/3 space-y-2">
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
          <Skeleton className="size-10 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div
      data-testid="table-skeleton"
      aria-busy="true"
      className={cn('bg-card border-border divide-border divide-y rounded-xl border', className)}
    >
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-3 px-4 py-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? 'h-4 w-5/6 rounded-md' : 'h-4 w-2/3 rounded-md'} />
          ))}
        </div>
      ))}
    </div>
  )
}
