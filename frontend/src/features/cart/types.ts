export interface CartItem {
  vegetableId: string
  unitId: string
  count: number
  /** Display info cached from catalog (not sent to server) */
  nameEn: string
  nameMr?: string
  nameHi?: string
  unitLabel: string
  pricePerUnit: string
  quantityInBaseUnit: string
  availableStock?: string | number | null
}

export interface CartComboItem {
  comboId: string
  count: number
  nameEn: string
  nameMr?: string
  nameHi?: string
  sellingPrice: string
  regularCombinedPrice?: string | null
  maxAvailableCombos?: number
  contentsSummary: string
}

export interface CartState {
  items: CartItem[]
  combos: CartComboItem[]
  clientRef: string
  addItem: (item: Omit<CartItem, never>) => void
  updateCount: (vegetableId: string, unitId: string, count: number) => void
  removeItem: (vegetableId: string, unitId: string) => void
  replaceItems: (items: CartItem[]) => void
  addCombo: (combo: CartComboItem) => void
  updateComboCount: (comboId: string, count: number) => void
  removeCombo: (comboId: string) => void
  replaceCombos: (combos: CartComboItem[]) => void
  clearCart: () => void
  resetClientRef: () => void
}
