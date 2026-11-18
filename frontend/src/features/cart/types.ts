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
}

export interface CartState {
  items: CartItem[]
  clientRef: string
  addItem: (item: Omit<CartItem, never>) => void
  updateCount: (vegetableId: string, unitId: string, count: number) => void
  removeItem: (vegetableId: string, unitId: string) => void
  replaceItems: (items: CartItem[]) => void
  clearCart: () => void
  resetClientRef: () => void
}
