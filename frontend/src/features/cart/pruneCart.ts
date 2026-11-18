import { dec } from '@/lib/money'
import type { PublicVegetable } from '@/features/catalog/types'
import type { CartItem } from './types'

export interface CartPruneResult {
  validItems: CartItem[]
  removedItems: CartItem[]
}

/**
 * Prunes cart lines whose vegetable is missing/out-of-stock or whose
 * selected size option is gone, unpriced, or exceeds available stock in the authoritative catalog.
 */
export function pruneCartWithCatalog(
  cartItems: CartItem[],
  catalog: PublicVegetable[],
): CartPruneResult {
  const validItems: CartItem[] = []
  const removedItems: CartItem[] = []

  const vegById = new Map(catalog.map((v) => [String(v.id), v]))
  const allocatedStockByVegId = new Map<string, ReturnType<typeof dec>>()

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

    const unitBaseQty = dec(opt.quantityInBaseUnit)
    let nextCount = item.count

    if (
      veg.availableStock !== undefined &&
      veg.availableStock !== null &&
      veg.availableStock !== '' &&
      unitBaseQty.gt(0)
    ) {
      const totalAvail = dec(veg.availableStock)
      const alreadyAllocated = allocatedStockByVegId.get(String(veg.id)) ?? dec(0)
      const remaining = totalAvail.sub(alreadyAllocated)
      const maxUnits = Math.floor(remaining.div(unitBaseQty).toNumber())

      if (maxUnits <= 0) {
        removedItems.push(item)
        continue
      }

      nextCount = Math.min(item.count, maxUnits, 20)
      allocatedStockByVegId.set(
        String(veg.id),
        alreadyAllocated.add(unitBaseQty.mul(nextCount)),
      )
    }

    validItems.push({
      ...item,
      count: nextCount,
      nameEn: veg.nameEn,
      nameMr: veg.nameMr ?? undefined,
      nameHi: veg.nameHi ?? undefined,
      unitLabel: opt.label,
      quantityInBaseUnit: String(opt.quantityInBaseUnit),
      pricePerUnit: String(opt.price),
      availableStock:
        veg.availableStock !== undefined && veg.availableStock !== null
          ? String(veg.availableStock)
          : item.availableStock,
    })
  }

  return { validItems, removedItems }
}
