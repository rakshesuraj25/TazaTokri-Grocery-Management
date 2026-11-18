export interface ExpectedVegetableImage {
  nameEn: string
  slug: string
}

export const EXPECTED_VEGETABLE_DISPLAY_NAMES = [
  'Amaranth (Math)',
  'Beetroot',
  'Bitter Gourd (Karela)',
  'Bottle Gourd (Dudhi)',
  'Brinjal (Vangi)',
  'Cabbage',
  'Capsicum',
  'Carrot (Gajar)',
  'Cauliflower',
  'Cluster Beans (Gawar)',
  'Cucumber',
  'Curry Leaves',
  'Dill Leaves (Shepu)',
  'Drumstick (Shevga)',
  'Fenugreek (Methi)',
  'French Beans',
  'Fresh Coriander',
  'Garlic (Lasun)',
  'Ginger (Ale)',
  'Green Chilli (Mirchi)',
  'Green Peas (Matar)',
  'Lemon (Limbu)',
  'Mint (Pudina)',
  'Okra (Bhendi)',
  'Onion (Kanda)',
  'Potato (Batata)',
  'Pumpkin (Bhopla)',
  'Radish (Mula)',
  'Raw Banana (Kaccha Kela)',
  'Ridge Gourd (Dodka)',
  'Spinach (Palak)',
  'Spring Onion',
  'Sweet Corn',
  'Sweet Potato (Ratale)',
  'Tomato',
  'Yam (Suran)',
] as const

/**
 * Converts an English vegetable name into a deterministic filename slug:
 * lowercase -> remove any parenthesis and its content -> strip other punctuation ->
 * trim -> replace spaces with hyphens.
 *
 * Examples:
 * - "Bottle Gourd (Dudhi)" -> "bottle-gourd"
 * - "Fresh Coriander" -> "fresh-coriander"
 * - "Green Chilli (Mirchi)" -> "green-chilli"
 */
export function vegetableSlug(nameEn?: string | null): string {
  return (nameEn ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Resolves the image path for a vegetable:
 * - Ignores any explicit URL containing `commons.wikimedia.org` (legacy seeded data).
 * - Uses `explicitUrl` if it is a non-empty path starting with `/vegetables/` or `https://`.
 * - Otherwise returns `/vegetables/<slug>.jpg`.
 */
export function resolveVegetableImage(
  nameEn?: string | null,
  explicitUrl?: string | null,
): string {
  const trimmedUrl = (explicitUrl ?? '').trim()
  if (
    trimmedUrl.length > 0 &&
    !trimmedUrl.toLowerCase().includes('commons.wikimedia.org') &&
    (trimmedUrl.startsWith('/vegetables/') || trimmedUrl.startsWith('https://'))
  ) {
    return trimmedUrl
  }

  const slug = vegetableSlug(nameEn)
  return slug ? `/vegetables/${slug}.jpg` : ''
}

export const EXPECTED_VEGETABLE_IMAGES: readonly ExpectedVegetableImage[] =
  EXPECTED_VEGETABLE_DISPLAY_NAMES.map((nameEn) => ({
    nameEn,
    slug: vegetableSlug(nameEn),
  }))
