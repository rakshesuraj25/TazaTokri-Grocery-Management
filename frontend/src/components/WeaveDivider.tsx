import { cn } from '@/lib/utils'

export interface WeaveDividerProps {
  variant?: 'subtle' | 'chalkboard'
  className?: string
}

/**
 * TazaTokri signature woven-basket (tokri) hairline divider motif.
 * Used sparingly on section headers, empty states, customer footer, and chalkboard display.
 */
export function WeaveDivider({ variant = 'subtle', className }: WeaveDividerProps) {
  const isChalk = variant === 'chalkboard'
  return (
    <div
      aria-hidden
      data-testid="weave-divider"
      className={cn('flex w-full items-center gap-3', className)}
    >
      <div
        className={cn(
          'h-px flex-1',
          isChalk ? 'border-t border-dashed border-amber-300/35' : 'bg-border/80',
        )}
      />
      <svg
        viewBox="0 0 64 12"
        className={cn(
          'h-3 w-16 shrink-0',
          isChalk ? 'text-amber-300/65' : 'text-soil/45',
        )}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 8.5L9 3.5L16 8.5L23 3.5L30 8.5L37 3.5L44 8.5L51 3.5L58 8.5L62 5.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2 3.5L9 8.5L16 3.5L23 8.5L30 3.5L37 8.5L44 3.5L51 8.5L58 3.5L62 6.5"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeOpacity="0.55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div
        className={cn(
          'h-px flex-1',
          isChalk ? 'border-t border-dashed border-amber-300/35' : 'bg-border/80',
        )}
      />
    </div>
  )
}
