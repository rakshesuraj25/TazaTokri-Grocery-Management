import { dec } from '@/lib/money'
import {
  filterVegetablesBySearch,
  matchesVegetableSearch,
  normalizeSearchText,
} from '@/utils/vegetable-search'
import type { PublicUnitOption, PublicVegetable } from './types'

export { filterVegetablesBySearch, matchesVegetableSearch, normalizeSearchText }

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
