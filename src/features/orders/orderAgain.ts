import type { CartItem } from '@/features/cart/types'
import type { PublicVegetable } from '@/features/catalog/types'
import { dec } from '@/lib/money'
import { MAX_ITEM_COUNT } from '@/lib/businessRules'
import type { OrderItemResponse, OrderResponse } from './types'

export interface OrderAgainResult {
  matched: CartItem[]
  skipped: string[]
}

/**
 * Matches past order lines onto active, priced size options in the live catalog.
 * Preserves exact item labels for any skipped/unmatched lines so the UI reports them.
 */
export function mapOrderItemsToCart(
  orderItems: OrderItemResponse[],
  catalog: PublicVegetable[],
): OrderAgainResult {
  const matched: CartItem[] = []
  const skipped: string[] = []
  const byId = new Map(catalog.map((v) => [String(v.id), v]))

  for (const line of orderItems) {
    const veg = byId.get(String(line.vegetableId))
    if (!veg || !veg.inStock) {
      skipped.push(line.vegetableName)
      continue
    }

    const pricedOpts = veg.options.filter(
      (o) => o.price !== null && o.price !== undefined && o.price !== '',
    )
    if (pricedOpts.length === 0) {
      skipped.push(line.vegetableName)
      continue
    }

    const orderedQty = dec(line.quantity)
    const exactOption = pricedOpts.find((o) =>
      dec(o.quantityInBaseUnit).eq(orderedQty),
    )

    if (exactOption) {
      matched.push({
        vegetableId: String(veg.id),
        unitId: String(exactOption.unitId),
        nameEn: veg.nameEn,
        nameMr: veg.nameMr ?? undefined,
        nameHi: veg.nameHi ?? undefined,
        unitLabel: exactOption.label,
        quantityInBaseUnit: String(exactOption.quantityInBaseUnit),
        pricePerUnit: String(exactOption.price),
        count: 1,
      })
      continue
    }

    // Try finding an existing option that divides orderedQty cleanly in [1..MAX_ITEM_COUNT]
    const sortedDesc = [...pricedOpts].sort((a, b) =>
      dec(b.quantityInBaseUnit).cmp(dec(a.quantityInBaseUnit)),
    )
    const divisible = sortedDesc.find((o) => {
      const unitQty = dec(o.quantityInBaseUnit)
      if (unitQty.lte(0)) return false
      const ratio = orderedQty.div(unitQty)
      return ratio.isInteger() && ratio.gte(1) && ratio.lte(MAX_ITEM_COUNT)
    })

    if (!divisible) {
      skipped.push(line.vegetableName)
      continue
    }

    const count = orderedQty.div(dec(divisible.quantityInBaseUnit)).toNumber()
    matched.push({
      vegetableId: String(veg.id),
      unitId: String(divisible.unitId),
      nameEn: veg.nameEn,
      nameMr: veg.nameMr ?? undefined,
      nameHi: veg.nameHi ?? undefined,
      unitLabel: divisible.label,
      quantityInBaseUnit: String(divisible.quantityInBaseUnit),
      pricePerUnit: String(divisible.price),
      count,
    })
  }

  return { matched, skipped }
}

/**
 * Computes the customer's "Your usual" vegetables ordered by frequency in recent orders,
 * keeping only vegetables currently present in the live public catalog.
 */
export function buildUsualVegetables(
  orders: OrderResponse[],
  catalog: PublicVegetable[],
  limit = 6,
): PublicVegetable[] {
  const counts = new Map<string, number>()
  for (const order of orders) {
    if (order.status === 'CANCELLED') continue
    for (const item of order.items) {
      const id = String(item.vegetableId)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }

  const byId = new Map(catalog.map((v) => [String(v.id), v]))
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id))
    .filter((v): v is PublicVegetable => Boolean(v && v.inStock))
    .slice(0, limit)
}
