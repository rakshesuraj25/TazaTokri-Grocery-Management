import { useEffect, useState } from 'react'
import { resolveVegetableImage, vegetableSlug } from '@/features/catalog/vegetableImages'
import { useVegetableName } from '@/hooks/useVegetableName'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { VegetablePlaceholder } from './VegetablePlaceholder'

export type VegetableImageSize = 'xs' | 'sm' | 'md' | 'lg' | 'card'

interface VegetableImageProps {
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  imageUrl?: string | null
  category?: string | null
  alt?: string
  size?: VegetableImageSize
  className?: string
  priority?: boolean
  onStatusChange?: (status: 'photo' | 'illustration') => void
}

/**
 * Uniform 1:1 square containers matching 600x600 self-hosted produce photos
 * and 120x120 category-washed SVG fallback illustrations.
 */
const SIZE_CLASSES: Record<VegetableImageSize, string> = {
  xs: 'size-10 aspect-square rounded-lg',
  sm: 'size-12 aspect-square rounded-xl',
  md: 'size-16 aspect-square rounded-xl',
  lg: 'size-24 aspect-square rounded-2xl',
  card: 'aspect-square w-full rounded-xl',
}

/**
 * Self-hosted vegetable photograph component with consistent 1:1 square ratio,
 * lazy decoding, localized alt text, and per-vegetable SVG illustration fallback.
 */
export function VegetableImage({
  nameEn,
  nameMr,
  nameHi,
  imageUrl,
  category,
  alt,
  size = 'sm',
  className = '',
  priority = false,
  onStatusChange,
}: VegetableImageProps) {
  const { name } = useVegetableName()
  const activeUrl = resolveVegetableImage(nameEn, imageUrl)
  const slug = vegetableSlug(nameEn)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const hasError = !activeUrl || failedUrl === activeUrl

  const finalAlt =
    alt ??
    name({
      nameEn,
      nameMr: nameMr ?? undefined,
      nameHi: nameHi ?? undefined,
    })

  const theme = getCategoryTheme(category)
  const intrinsicSize = size === 'card' || size === 'lg' ? 600 : 128

  useEffect(() => {
    if (hasError) {
      onStatusChange?.('illustration')
    }
  }, [hasError, onStatusChange])

  return (
    <div
      data-vegetable-slug={slug}
      data-image-state={hasError ? 'illustration' : 'photo'}
      className={`${theme.borderClass} ${theme.washClass} relative aspect-square shrink-0 overflow-hidden border select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {!hasError ? (
        <img
          src={activeUrl}
          alt={finalAlt}
          width={intrinsicSize}
          height={intrinsicSize}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => onStatusChange?.('photo')}
          onError={() => {
            setFailedUrl(activeUrl)
            onStatusChange?.('illustration')
          }}
          className="h-full w-full object-cover object-center transition-transform duration-200"
        />
      ) : (
        <VegetablePlaceholder
          nameEn={nameEn}
          category={category}
          label={finalAlt}
          size={size}
        />
      )}
    </div>
  )
}
