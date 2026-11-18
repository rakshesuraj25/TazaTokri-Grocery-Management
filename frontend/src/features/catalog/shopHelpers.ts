import { dec } from '@/lib/money'
import { vegetableSlug } from './vegetableImages'
import type { PublicUnitOption, PublicVegetable } from './types'

/**
 * Common Indian market transliteration & regional spelling aliases keyed by slug,
 * so searching "bhindi", "baingan", "aloo", "pyaz", "dhaniya", "matar", "lauki", etc.
 * reliably matches the right catalog vegetable in addition to EN/MR/HI names.
 */
const SEARCH_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  amaranth: ['math', 'chaulai', 'lal maath'],
  beetroot: ['beet', 'chukandar'],
  'bitter-gourd': ['karela', 'karle', 'karli'],
  'bottle-gourd': ['dudhi', 'doodhi', 'lauki', 'ghiya', 'kaddu'],
  brinjal: ['vangi', 'baingan', 'eggplant', 'aubergine', 'bharit'],
  cabbage: ['kobi', 'patta gobhi', 'band gobhi'],
  capsicum: ['shimla mirch', 'bell pepper', 'dhobali mirchi'],
  carrot: ['gajar'],
  cauliflower: ['flower', 'phool gobhi', 'gobi', 'gobhi'],
  'cluster-beans': ['gawar', 'gavar', 'guar'],
  cucumber: ['kakdi', 'kheera'],
  'curry-leaves': ['kadi patta', 'kadipatta', 'kadhi patta', 'meetha neem'],
  'dill-leaves': ['shepu', 'suva', 'soya'],
  drumstick: ['shevga', 'sahjan', 'moringa'],
  fenugreek: ['methi'],
  'french-beans': ['farasbi', 'fanasbi', 'beans', 'phali'],
  'fresh-coriander': ['kothimbir', 'dhaniya', 'dhania', 'cilantro'],
  garlic: ['lasun', 'lahsun', 'lehsun'],
  ginger: ['ale', 'adrak'],
  'green-chilli': ['mirchi', 'mirch', 'hari mirch', 'hirvi mirchi', 'chili'],
  'green-peas': ['matar', 'watana', 'vatana'],
  lemon: ['limbu', 'nimbu', 'lime'],
  mint: ['pudina'],
  okra: ['bhendi', 'bhindi', 'lady finger', 'ladies finger'],
  onion: ['kanda', 'pyaz', 'pyaj'],
  potato: ['batata', 'aloo', 'alu'],
  pumpkin: ['bhopla', 'kaddu', 'lal bhopla'],
  radish: ['mula', 'mooli'],
  'raw-banana': ['kaccha kela', 'kachcha kela', 'kel', 'keli'],
  'ridge-gourd': ['dodka', 'turai', 'tori', 'turia'],
  spinach: ['palak'],
  'spring-onion': ['kanda pat', 'hara pyaz', 'scallion'],
  'sweet-corn': ['makka', 'bhutta', 'kanis', 'corn'],
  'sweet-potato': ['ratale', 'shakarkand', 'shakar kand'],
  tomato: ['tamatar', 'tomatoes'],
  yam: ['suran', 'jimikand', 'elephant foot'],
}

/**
 * Normalize text for bilingual search matching:
 * trims whitespace, strips parentheses, collapses spaces, and lowercases.
 */
export function normalizeSearchText(input: string): string {
  return input
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function matchesVegetableSearch(
  veg: Pick<PublicVegetable, 'nameEn' | 'nameMr' | 'nameHi'>,
  query: string,
): boolean {
  const normQuery = normalizeSearchText(query)
  if (!normQuery) return true

  const slug = vegetableSlug(veg.nameEn)
  const synonyms = SEARCH_SYNONYMS[slug] ?? []
  const candidates = [veg.nameEn, veg.nameMr ?? '', veg.nameHi ?? '', slug.replace(/-/g, ' '), ...synonyms]

  return candidates.some((c) => {
    const raw = c.trim().toLowerCase()
    return raw.includes(normQuery) || normalizeSearchText(c).includes(normQuery)
  })
}

export function sortPublicOptions(options: PublicUnitOption[]): PublicUnitOption[] {
  return [...options].sort((a, b) =>
    dec(a.quantityInBaseUnit).cmp(dec(b.quantityInBaseUnit)),
  )
}

export type ShopSortOption = 'name' | 'priceAsc' | 'priceDesc'

/**
 * Client-side sort over loaded catalog items. Unpriced items sort after priced items on price sorts.
 */
export function sortPublicVegetables(
  list: PublicVegetable[],
  sortBy: ShopSortOption,
  getName: (veg: PublicVegetable) => string,
): PublicVegetable[] {
  const copy = [...list]
  if (sortBy === 'name') {
    return copy.sort((a, b) => getName(a).localeCompare(getName(b)))
  }

  return copy.sort((a, b) => {
    const aHas = a.pricePerUnit !== null && a.pricePerUnit !== undefined && a.pricePerUnit !== ''
    const bHas = b.pricePerUnit !== null && b.pricePerUnit !== undefined && b.pricePerUnit !== ''
    if (!aHas && !bHas) return getName(a).localeCompare(getName(b))
    if (!aHas) return 1
    if (!bHas) return -1
    const cmp = dec(a.pricePerUnit!).cmp(dec(b.pricePerUnit!))
    if (cmp !== 0) return sortBy === 'priceAsc' ? cmp : -cmp
    return getName(a).localeCompare(getName(b))
  })
}
