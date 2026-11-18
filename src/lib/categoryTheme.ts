export type CategoryTone = 'leafy' | 'everyday' | 'roots' | 'neutral'

export interface CategoryTheme {
  tone: CategoryTone
  /** Subtle background wash for placeholders & badges */
  washClass: string
  /** Accent bar / indicator stripe colour */
  barClass: string
  /** SVG line illustration & accent icon colour */
  strokeClass: string
  /** Text colour for category pills / headings */
  textClass: string
  /** Border colour for category surfaces */
  borderClass: string
}

const CATEGORY_THEMES: Record<CategoryTone, CategoryTheme> = {
  leafy: {
    tone: 'leafy',
    washClass: 'bg-secondary/75',
    barClass: 'bg-primary',
    strokeClass: 'text-primary',
    textClass: 'text-secondary-foreground',
    borderClass: 'border-primary/25',
  },
  everyday: {
    tone: 'everyday',
    washClass: 'bg-turmeric-light/85',
    barClass: 'bg-turmeric',
    strokeClass: 'text-turmeric-foreground',
    textClass: 'text-turmeric-foreground',
    borderClass: 'border-turmeric/35',
  },
  roots: {
    tone: 'roots',
    washClass: 'bg-soil-light/90',
    barClass: 'bg-soil',
    strokeClass: 'text-soil',
    textClass: 'text-soil-foreground',
    borderClass: 'border-soil/30',
  },
  neutral: {
    tone: 'neutral',
    washClass: 'bg-muted/80',
    barClass: 'bg-muted-foreground/50',
    strokeClass: 'text-muted-foreground',
    textClass: 'text-muted-foreground',
    borderClass: 'border-border',
  },
}

/**
 * Resolve category name (English, Marathi, Hindi, or slug) to one of the
 * four design-system category tones: leafy green, everyday turmeric, roots soil, or neutral.
 */
export function resolveCategoryTone(category?: string | null): CategoryTone {
  const value = (category ?? '').trim().toLowerCase()
  if (!value) return 'neutral'

  if (
    value.includes('leafy') ||
    value.includes('green') ||
    value.includes('पालेभाज') ||
    value.includes('पत्तेदार') ||
    value.includes('पालक')
  ) {
    return 'leafy'
  }

  if (
    value.includes('everyday') ||
    value.includes('daily') ||
    value.includes('फळभाज') ||
    value.includes('रोजच्या') ||
    value.includes('रोजमर्रा') ||
    value.includes('दैनिक')
  ) {
    return 'everyday'
  }

  if (
    value.includes('root') ||
    value.includes('tuber') ||
    value.includes('कंद') ||
    value.includes('जड़')
  ) {
    return 'roots'
  }

  return 'neutral'
}

export function getCategoryTheme(category?: string | null): CategoryTheme {
  return CATEGORY_THEMES[resolveCategoryTone(category)]
}
