import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface DataTableProps {
  children: ReactNode
  compact?: boolean
  className?: string
  'aria-label'?: string
}

/**
 * Shared responsive table surface for catalog, pricing, stock, purchases, suppliers, and payments.
 */
export function DataTable({ children, compact = false, className, 'aria-label': ariaLabel }: DataTableProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table
          aria-label={ariaLabel}
          className={cn('w-full border-collapse text-sm', !compact && 'min-w-[600px]')}
        >
          {children}
        </table>
      </div>
    </Card>
  )
}
