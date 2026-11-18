/**
 * Distinct, consistent inline-SVG line illustrations for all 36 TazaTokri vegetables.
 * Every entry shares a 120x120 coordinate space, clean rounded strokes, and zero fill,
 * tinted by the category colour wash at render time.
 */

export interface IllustrationPath {
  d: string
  opacity?: number
  strokeWidth?: number
}

export interface VegetableIllustrationSpec {
  slug: string
  /** True if silhouette is close to siblings and relies on the visible label at small sizes. */
  needsLabelEmphasis?: boolean
  paths: readonly IllustrationPath[]
}

export const GENERIC_LEAF_ILLUSTRATION: VegetableIllustrationSpec = {
  slug: 'generic-leaf',
  needsLabelEmphasis: true,
  paths: [
    { d: 'M60 98V52' },
    { d: 'M60 78C36 78 26 60 28 34C54 34 60 52 60 78Z' },
    { d: 'M60 66C60 40 72 22 94 22C94 48 80 66 60 66Z' },
    { d: 'M60 60L82 36M60 68L40 48', opacity: 0.65, strokeWidth: 2.5 },
  ],
}

export const VEGETABLE_ILLUSTRATIONS: Readonly<Record<string, VegetableIllustrationSpec>> = {
  // --- Leafy Greens ---
  'fresh-coriander': {
    slug: 'fresh-coriander',
    paths: [
      { d: 'M52 102L58 64M68 102L62 64M46 78H74' },
      { d: 'M42 54C30 52 24 40 32 32C36 28 44 30 46 36C48 26 58 24 62 32C66 26 78 26 82 36C90 36 94 48 84 56C78 60 70 58 64 56' },
      { d: 'M58 64L42 42M60 64V34M62 64L78 44', opacity: 0.7, strokeWidth: 2.6 },
    ],
  },
  spinach: {
    slug: 'spinach',
    paths: [
      { d: 'M60 102V64M48 98L56 72M72 98L64 72' },
      { d: 'M60 64C42 64 34 46 44 28C52 18 68 18 76 28C86 46 78 64 60 64Z' },
      { d: 'M44 68C28 66 22 52 28 40C34 32 42 36 44 46' },
      { d: 'M76 68C92 66 98 52 92 40C86 32 78 36 76 46' },
      { d: 'M60 62V30M60 48L50 38M60 44L70 34', opacity: 0.65, strokeWidth: 2.5 },
    ],
  },
  fenugreek: {
    slug: 'fenugreek',
    paths: [
      { d: 'M60 102V54M48 96L58 70M72 96L62 70' },
      { d: 'M60 42C52 42 48 34 52 26C56 20 64 20 68 26C72 34 68 42 60 42Z' },
      { d: 'M48 52C38 56 28 50 30 40C32 32 42 32 48 40Z' },
      { d: 'M72 52C82 56 92 50 90 40C88 32 78 32 72 40Z' },
      { d: 'M42 74C32 76 26 70 28 62C34 58 42 62 46 68' },
      { d: 'M78 74C88 76 94 70 92 62C86 58 78 62 74 68' },
    ],
  },
  mint: {
    slug: 'mint',
    paths: [
      { d: 'M60 102V28' },
      { d: 'M60 44C48 32 48 20 60 16C72 20 72 32 60 44Z' },
      { d: 'M60 62C42 62 32 54 34 42C42 38 52 44 60 56' },
      { d: 'M60 62C78 62 88 54 86 42C78 38 68 44 60 56' },
      { d: 'M60 82C40 84 30 76 32 64C42 62 50 68 60 76' },
      { d: 'M60 82C80 84 90 76 88 64C78 62 70 68 60 76' },
    ],
  },
  amaranth: {
    slug: 'amaranth',
    needsLabelEmphasis: true,
    paths: [
      { d: 'M60 102V60M50 96L56 74M70 96L64 74' },
      { d: 'M60 60C38 58 32 40 42 24C50 16 70 16 78 24C88 40 82 58 60 60Z' },
      { d: 'M60 56V26M60 44L48 34M60 44L72 34M60 52L46 46M60 52L74 46', opacity: 0.7, strokeWidth: 2.5 },
    ],
  },
  'dill-leaves': {
    slug: 'dill-leaves',
    needsLabelEmphasis: true,
    paths: [
      { d: 'M54 102L60 64M66 102L60 64M48 84H72' },
      { d: 'M60 64V24M60 58L32 34M60 58L88 34M60 46L38 24M60 46L82 24' },
      { d: 'M38 40L24 38M46 32L32 22M82 40L96 38M74 32L88 22', opacity: 0.75, strokeWidth: 2.6 },
    ],
  },
  'curry-leaves': {
    slug: 'curry-leaves',
    paths: [
      { d: 'M60 102C60 74 62 46 66 20' },
      { d: 'M64 34C50 30 42 22 46 16C54 16 62 24 64 34Z' },
      { d: 'M63 48C46 46 36 38 40 30C50 30 58 38 63 48Z' },
      { d: 'M63 44C78 40 88 32 84 24C74 26 66 34 63 44Z' },
      { d: 'M61 66C44 64 34 56 38 48C48 48 56 56 61 66Z' },
      { d: 'M61 62C78 58 88 50 84 42C74 44 66 52 61 62Z' },
      { d: 'M60 82C46 80 38 74 42 66C50 66 56 72 60 82Z' },
      { d: 'M60 80C76 76 84 68 80 60C72 62 64 70 60 80Z' },
    ],
  },
  'spring-onion': {
    slug: 'spring-onion',
    paths: [
      { d: 'M46 98C38 98 34 90 38 80L46 22L52 80C56 90 54 98 46 98Z' },
      { d: 'M72 98C64 98 62 90 66 78L76 18L82 78C86 90 80 98 72 98Z' },
      { d: 'M42 98L38 106M48 98L48 106M68 98L66 106M76 98L78 106', opacity: 0.7, strokeWidth: 2.5 },
      { d: 'M46 64V36M75 60V32', opacity: 0.6, strokeWidth: 2.4 },
    ],
  },

  // --- Everyday Vegetables ---
  tomato: {
    slug: 'tomato',
    paths: [
      { d: 'M60 36C82 36 96 49 96 68C96 87 80 98 60 98C40 98 24 87 24 68C24 49 38 36 60 36Z' },
      { d: 'M60 36V20M46 34L60 40L74 34M42 44L60 40L78 44' },
      { d: 'M38 62C38 52 44 46 52 44', opacity: 0.65, strokeWidth: 2.6 },
    ],
  },
  brinjal: {
    slug: 'brinjal',
    paths: [
      { d: 'M62 34C74 36 82 54 80 74C78 90 68 100 54 98C40 96 34 82 40 62C44 46 50 34 62 34Z' },
      { d: 'M46 42L54 34L60 42L68 34L74 44M60 34C60 24 66 20 72 22' },
      { d: 'M48 76C48 64 52 54 56 48', opacity: 0.65, strokeWidth: 2.6 },
    ],
  },
  okra: {
    slug: 'okra',
    paths: [
      { d: 'M66 22C74 26 76 38 72 56C68 74 58 92 48 100C42 92 44 72 50 52C54 34 58 24 66 22Z' },
      { d: 'M58 26L68 28M68 22L74 14' },
      { d: 'M62 32C60 54 54 74 49 90', opacity: 0.7, strokeWidth: 2.5 },
    ],
  },
  cauliflower: {
    slug: 'cauliflower',
    paths: [
      { d: 'M36 58C28 48 34 34 46 34C48 22 68 20 74 32C86 32 92 46 84 58C88 68 78 76 66 74C56 78 44 74 36 58Z' },
      { d: 'M32 62C24 72 30 90 48 92L60 80L72 92C90 90 96 72 88 62' },
      { d: 'M48 48C54 44 62 46 66 52M48 60C54 58 62 60 66 64', opacity: 0.65, strokeWidth: 2.5 },
    ],
  },
  cabbage: {
    slug: 'cabbage',
    paths: [
      { d: 'M60 26C80 26 94 40 94 60C94 80 80 94 60 94C40 94 26 80 26 60C26 40 40 26 60 26Z' },
      { d: 'M34 74C38 54 52 42 74 40M86 72C78 56 64 50 44 56' },
      { d: 'M48 86C58 74 68 62 72 44', opacity: 0.7, strokeWidth: 2.6 },
    ],
  },
  'bottle-gourd': {
    slug: 'bottle-gourd',
    paths: [
      { d: 'M54 24H66C68 38 66 46 72 56C82 68 82 88 68 96C58 100 46 96 42 84C38 72 46 58 52 48C54 40 52 32 54 24Z' },
      { d: 'M60 24V15' },
      { d: 'M52 78C50 68 54 60 58 54', opacity: 0.65, strokeWidth: 2.5 },
    ],
  },
  'bitter-gourd': {
    slug: 'bitter-gourd',
    paths: [
      { d: 'M74 22C82 32 82 54 72 74C64 90 50 98 40 98C36 86 40 66 48 48C56 32 66 22 74 22Z' },
      { d: 'M74 22L78 15M40 98L36 104' },
      { d: 'M56 44C58 48 54 52 50 54M68 48C66 54 62 58 58 60M52 68C54 74 48 78 44 80M62 72C60 78 56 82 52 84', opacity: 0.75, strokeWidth: 2.6 },
    ],
  },
  'ridge-gourd': {
    slug: 'ridge-gourd',
    paths: [
      { d: 'M76 20C82 26 78 48 66 72C56 90 46 100 38 98C36 90 44 68 56 46C64 30 70 20 76 20Z' },
      { d: 'M70 28C62 46 52 68 43 92M74 34C66 52 56 74 47 94', opacity: 0.75, strokeWidth: 2.5 },
      { d: 'M76 20L82 14' },
    ],
  },
  capsicum: {
    slug: 'capsicum',
    paths: [
      { d: 'M36 42C36 32 50 30 60 36C70 30 84 32 84 42C90 54 88 78 78 88C72 94 64 92 60 88C56 92 48 94 42 88C32 78 30 54 36 42Z' },
      { d: 'M60 36C60 26 64 20 70 20' },
      { d: 'M48 44C46 58 46 74 50 86M72 44C74 58 74 74 70 86', opacity: 0.65, strokeWidth: 2.5 },
    ],
  },
  'green-chilli': {
    slug: 'green-chilli',
    paths: [
      { d: 'M70 26C82 32 84 52 72 72C62 88 42 98 28 96C36 86 48 76 56 60C62 46 60 32 70 26Z' },
      { d: 'M64 28L74 26M70 24C72 16 78 14 84 16' },
      { d: 'M68 42C66 56 58 70 46 82', opacity: 0.65, strokeWidth: 2.5 },
    ],
  },
  lemon: {
    slug: 'lemon',
    paths: [
      { d: 'M24 62C24 44 40 34 60 34C80 34 96 44 96 62C96 80 80 88 60 88C40 88 24 80 24 62Z' },
      { d: 'M24 62C20 62 18 60 20 56M96 62C100 62 102 60 100 56' },
      { d: 'M44 50C44 50 45 51 46 50M54 46C54 46 55 47 56 46M48 64C48 64 49 65 50 64M72 70C72 70 73 71 74 70', strokeWidth: 3 },
    ],
  },
  cucumber: {
    slug: 'cucumber',
    paths: [
      { d: 'M30 84C24 76 28 64 42 50L70 24C80 18 90 22 92 32C94 40 86 52 72 66L44 90C36 94 32 88 30 84Z' },
      { d: 'M88 24L96 18' },
      { d: 'M46 64H47M60 50H61M74 36H75M56 68H57M70 54H71', opacity: 0.75, strokeWidth: 3 },
    ],
  },
  pumpkin: {
    slug: 'pumpkin',
    paths: [
      { d: 'M60 38C82 38 98 48 98 66C98 84 82 94 60 94C38 94 22 84 22 66C22 48 38 38 60 38Z' },
      { d: 'M60 38V94M44 40C38 54 38 78 44 92M76 40C82 54 82 78 76 92', opacity: 0.75, strokeWidth: 2.6 },
      { d: 'M56 38C56 26 60 20 68 20L66 38' },
    ],
  },
  'french-beans': {
    slug: 'french-beans',
    paths: [
      { d: 'M42 22C34 42 38 72 56 96C62 94 58 76 50 56C46 42 46 30 42 22Z' },
      { d: 'M66 20C60 44 64 72 82 94C88 92 84 74 76 54C72 40 72 28 66 20Z' },
      { d: 'M42 22C42 16 48 14 54 16M66 20C66 14 72 12 78 14', opacity: 0.75, strokeWidth: 2.6 },
    ],
  },
  'cluster-beans': {
    slug: 'cluster-beans',
    needsLabelEmphasis: true,
    paths: [
      { d: 'M60 22V34M50 32H70' },
      { d: 'M54 32L36 86C40 90 46 84 56 34' },
      { d: 'M60 32V92C64 92 66 84 64 34' },
      { d: 'M66 32L84 84C80 88 74 82 66 34' },
    ],
  },
  'green-peas': {
    slug: 'green-peas',
    paths: [
      { d: 'M24 72C34 44 58 28 96 28C88 58 64 84 24 72Z' },
      { d: 'M44 64A6 6 0 1 0 44.1 64M59 56A6 6 0 1 0 59.1 56M74 47A6 6 0 1 0 74.1 47' },
      { d: 'M96 28C102 22 106 24 104 32', opacity: 0.75, strokeWidth: 2.6 },
    ],
  },
  drumstick: {
    slug: 'drumstick',
    paths: [
      { d: 'M34 22L48 98M42 20L56 96' },
      { d: 'M72 20L84 98M80 18L92 96' },
      { d: 'M37 42H45M40 64H48M43 82H51M75 40H83M78 62H86M81 80H89', opacity: 0.7, strokeWidth: 2.4 },
    ],
  },
  'raw-banana': {
    slug: 'raw-banana',
    paths: [
      { d: 'M40 34C28 54 34 80 58 94C64 88 54 70 48 48L46 34' },
      { d: 'M56 32C46 54 54 80 78 90C82 82 70 64 64 46L62 32' },
      { d: 'M72 30C66 52 74 74 94 82C96 74 84 58 78 42L76 28' },
      { d: 'M38 34C48 26 66 24 80 28' },
    ],
  },
  'sweet-corn': {
    slug: 'sweet-corn',
    paths: [
      { d: 'M46 68V38C46 26 52 20 60 20C68 20 74 26 74 38V68' },
      { d: 'M60 20V12M54 20L50 14M66 20L70 14', opacity: 0.7, strokeWidth: 2.4 },
      { d: 'M46 42H74M46 54H74M56 26V66M64 26V66', opacity: 0.6, strokeWidth: 2.2 },
      { d: 'M36 96C30 74 34 54 44 46L58 96M84 96C90 74 86 54 76 46L62 96M44 96H76' },
    ],
  },

  // --- Roots & Tubers ---
  potato: {
    slug: 'potato',
    paths: [
      { d: 'M24 62C24 44 40 34 62 36C84 38 96 50 96 66C96 82 80 90 58 88C36 86 24 78 24 62Z' },
      { d: 'M44 54H46M64 48H66M74 68H76M50 72H52', strokeWidth: 3.4 },
    ],
  },
  onion: {
    slug: 'onion',
    paths: [
      { d: 'M60 28C66 38 90 48 90 68C90 86 76 94 60 94C44 94 30 86 30 68C30 48 54 38 60 28Z' },
      { d: 'M60 28L56 18M60 28L64 18' },
      { d: 'M60 32V92M48 42C42 56 42 78 50 90M72 42C78 56 78 78 70 90', opacity: 0.65, strokeWidth: 2.5 },
      { d: 'M52 94L48 102M60 94V104M68 94L72 102', opacity: 0.75, strokeWidth: 2.4 },
    ],
  },
  garlic: {
    slug: 'garlic',
    paths: [
      { d: 'M60 24C64 40 90 50 90 72C90 86 76 92 60 92C44 92 30 86 30 72C30 50 56 40 60 24Z' },
      { d: 'M56 26C56 18 64 18 64 26' },
      { d: 'M60 38V90M46 50C40 64 40 80 48 90M74 50C80 64 80 80 72 90', opacity: 0.75, strokeWidth: 2.6 },
    ],
  },
  ginger: {
    slug: 'ginger',
    paths: [
      { d: 'M26 70C20 62 24 50 36 48C42 48 46 50 50 44C52 32 64 28 72 34C78 40 76 48 84 48C94 48 98 60 90 68C84 74 76 72 72 78C68 88 54 90 48 80C42 74 32 78 26 70Z' },
      { d: 'M42 62C46 58 50 58 54 62M64 44C66 48 64 52 60 54M76 58C74 62 76 66 80 68', opacity: 0.65, strokeWidth: 2.4 },
    ],
  },
  carrot: {
    slug: 'carrot',
    paths: [
      { d: 'M42 38C48 30 72 30 78 38C74 62 66 86 60 102C54 86 46 62 42 38Z' },
      { d: 'M60 32V16M60 32L46 18M60 32L74 18' },
      { d: 'M48 52H58M62 64H70M52 78H60', opacity: 0.7, strokeWidth: 2.6 },
    ],
  },
  beetroot: {
    slug: 'beetroot',
    paths: [
      { d: 'M60 38C80 38 92 48 90 66C88 80 68 88 60 100C52 88 32 80 30 66C28 48 40 38 60 38Z' },
      { d: 'M54 38L44 18M60 38V14M66 38L76 18' },
      { d: 'M42 58C44 50 50 46 56 46', opacity: 0.65, strokeWidth: 2.5 },
    ],
  },
  radish: {
    slug: 'radish',
    paths: [
      { d: 'M48 36H72C72 58 66 86 60 104C54 86 48 58 48 36Z' },
      { d: 'M52 36L42 18M60 36V14M68 36L78 18' },
      { d: 'M52 52H62M56 68H66M56 82H62', opacity: 0.7, strokeWidth: 2.5 },
    ],
  },
  'sweet-potato': {
    slug: 'sweet-potato',
    paths: [
      { d: 'M24 72C26 52 46 38 66 38C82 38 96 44 96 54C92 74 72 86 50 86C34 86 24 80 24 72Z' },
      { d: 'M24 72L16 78M96 54L104 48' },
      { d: 'M46 58L52 60M68 54L74 56M58 72L64 72', opacity: 0.65, strokeWidth: 2.5 },
    ],
  },
  yam: {
    slug: 'yam',
    needsLabelEmphasis: true,
    paths: [
      { d: 'M26 70C22 48 36 32 60 32C84 32 98 48 94 70C90 86 76 92 60 92C44 92 30 86 26 70Z' },
      { d: 'M38 56L52 50M64 46L80 54M44 74L64 78M70 70L82 68', opacity: 0.65, strokeWidth: 2.5 },
    ],
  },
}

export function getVegetableIllustration(slug?: string | null): VegetableIllustrationSpec {
  if (slug && slug in VEGETABLE_ILLUSTRATIONS) {
    return VEGETABLE_ILLUSTRATIONS[slug]!
  }
  return GENERIC_LEAF_ILLUSTRATION
}
