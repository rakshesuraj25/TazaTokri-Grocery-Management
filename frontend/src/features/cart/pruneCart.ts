import type { PublicVegetable } from '@/features/catalog/types'
import type { CartItem } from './types'

export interface CartPruneResult {
  validItems: CartItem[]
  removedItems: CartItem[]
}

/**
 * Prunes cart lines whose vegetable is missing/out-of-stock or whose
 * selected size option is gone or unpriced in the authoritative catalog.
 */
export function pruneCartWithCatalog(
  cartItems: CartItem[],
  catalog: PublicVegetable[],
): CartPruneResult {
  const validItems: CartItem[] = []
  const removedItems: CartItem[] = []

  const vegById = new Map(catalog.map((v) => [String(v.id), v]))

  for (const item of cartItems) {
    const veg = vegById.get(String(item.vegetableId))
    if (!veg || !veg.inStock) {
      removedItems.push(item)
      continue
    }

    const opt = veg.options.find((o) => String(o.unitId) === String(item.unitId))
    if (!opt || opt.price === null || opt.price === undefined || opt.price === '') {
      removedItems.push(item)
      continue
    }

    validItems.push({
      ...item,
      nameEn: veg.nameEn,
      nameMr: veg.nameMr ?? undefined,
      nameHi: veg.nameHi ?? undefined,
      unitLabel: opt.label,
      quantityInBaseUnit: String(opt.quantityInBaseUnit),
      pricePerUnit: String(opt.price),
    })
  }

  return { validItems, removedItems }
}
