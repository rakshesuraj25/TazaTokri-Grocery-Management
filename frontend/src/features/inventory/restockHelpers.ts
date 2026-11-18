import type { StaffCatalogItem } from '@/features/catalog/types'
import { isLowStock } from '@/lib/businessRules'
import { dec, formatQty } from '@/lib/money'

export function buildRestockItems(items: StaffCatalogItem[]): StaffCatalogItem[] {
  return items
    .filter((i) => dec(i.stock).lte(0) || isLowStock(i.stock, i.baseUnit))
    .sort((a, b) => dec(a.stock).cmp(dec(b.stock)))
}

export function buildWhatsAppRestockText(
  items: StaffCatalogItem[],
  dateLabel: string,
): string {
  const restock = buildRestockItems(items)
  if (restock.length === 0) {
    return `TazaTokri Restock (${dateLabel}): All items stocked above threshold.`
  }
  return [
    `TazaTokri Restock List (${dateLabel})`,
    ...restock.map((i) => {
      const status = dec(i.stock).lte(0) ? 'OUT OF STOCK' : `Low (${formatQty(i.stock)} ${i.baseUnit})`
      return `- ${i.nameEn}: ${status}`
    }),
  ].join('\n')
}
