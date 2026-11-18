import { getVegetableIllustration } from '@/features/catalog/vegetableIllustrations'
import { vegetableSlug } from '@/features/catalog/vegetableImages'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { cn } from '@/lib/utils'

export type VegetablePlaceholderSize = 'xs' | 'sm' | 'md' | 'lg' | 'card'

export interface VegetablePlaceholderProps {
  nameEn?: string | null
  category?: string | null
  label?: string
  size?: VegetablePlaceholderSize
  className?: string
}

const SVG_SIZE: Record<VegetablePlaceholderSize, string> = {
  xs: 'size-5',
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-12',
  card: 'size-20',
}

const LABEL_SIZE: Record<VegetablePlaceholderSize, string> = {
  xs: 'text-[7px] leading-none',
  sm: 'text-[8.5px] leading-none',
  md: 'text-[10px] leading-tight',
  lg: 'text-[11px] leading-tight',
  card: 'text-xs leading-tight',
}

const PADDING_SIZE: Record<VegetablePlaceholderSize, string> = {
  xs: 'gap-0.5 p-1',
  sm: 'gap-0.5 p-1',
  md: 'gap-1 p-1.5',
  lg: 'gap-1.5 p-2',
  card: 'gap-2 p-3',
}

/**
 * Category-tinted vegetable placeholder with a distinct per-vegetable inline-SVG
 * line illustration and visible vegetable label at every size.
 * Never displays a substitute vegetable photograph.
 */
export function VegetablePlaceholder({
  nameEn,
  category,
  label = 'Vegetable',
  size = 'sm',
  className,
}: VegetablePlaceholderProps) {
  const theme = getCategoryTheme(category)
  const slug = vegetableSlug(nameEn || label)
  const spec = getVegetableIllustration(slug)

  return (
    <div
      role="img"
      aria-label={label}
      data-testid="vegetable-image-placeholder"
      data-category-tone={theme.tone}
      data-vegetable-slug={spec.slug}
      className={cn(
        'flex h-full w-full flex-col items-center justify-center',
        PADDING_SIZE[size],
        theme.washClass,
        theme.strokeClass,
        className,
      )}
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(SVG_SIZE[size], 'shrink-0 opacity-90')}
        aria-hidden
        data-illustration={theme.tone}
        data-vegetable-slug={spec.slug}
      >
        {spec.paths.map((p, index) => (
          <path
            key={index}
            d={p.d}
            stroke="currentColor"
            strokeWidth={p.strokeWidth ?? 3.6}
            strokeOpacity={p.opacity ?? 1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <span
        className={cn(
          'w-full max-w-full truncate text-center font-semibold',
          LABEL_SIZE[size],
          theme.textClass,
        )}
      >
        {label}
      </span>
    </div>
  )
}
