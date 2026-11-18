/**
 * Cart Zustand store with localStorage persistence.
 * clientRef is generated once per cart "session" and
 * reused on retries to ensure idempotency.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createClientRef } from '@/lib/idempotency'
import type { CartState } from './types'

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      clientRef: createClientRef(),

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.vegetableId === item.vegetableId && i.unitId === item.unitId,
          )
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.vegetableId === item.vegetableId && i.unitId === item.unitId
                  ? { ...i, count: Math.min(i.count + item.count, 20) }
                  : i,
              ),
            }
          }
          return { items: [...state.items, { ...item, count: Math.min(item.count, 20) }] }
        }),

      updateCount: (vegetableId, unitId, count) =>
        set((state) => ({
          items:
            count <= 0
              ? state.items.filter(
                  (i) => !(i.vegetableId === vegetableId && i.unitId === unitId),
                )
              : state.items.map((i) =>
                  i.vegetableId === vegetableId && i.unitId === unitId
                    ? { ...i, count: Math.min(count, 20) }
                    : i,
                ),
        })),

      removeItem: (vegetableId, unitId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.vegetableId === vegetableId && i.unitId === unitId),
          ),
        })),

      replaceItems: (items) =>
        set({ items }),

      clearCart: () =>
        set({ items: [], clientRef: createClientRef() }),

      resetClientRef: () =>
        set({ clientRef: createClientRef() }),
    }),
    {
      name: 'tazatokri-cart',
    },
  ),
)
