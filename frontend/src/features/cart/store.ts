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
      combos: [],
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

      addCombo: (combo) =>
        set((state) => {
          const maxCap =
            combo.maxAvailableCombos && combo.maxAvailableCombos > 0
              ? Math.min(combo.maxAvailableCombos, 10)
              : 10
          const existing = state.combos.find((c) => c.comboId === combo.comboId)
          if (existing) {
            return {
              combos: state.combos.map((c) =>
                c.comboId === combo.comboId
                  ? { ...c, count: Math.min(c.count + combo.count, maxCap) }
                  : c,
              ),
            }
          }
          return {
            combos: [...state.combos, { ...combo, count: Math.min(combo.count, maxCap) }],
          }
        }),

      updateComboCount: (comboId, count) =>
        set((state) => ({
          combos:
            count <= 0
              ? state.combos.filter((c) => c.comboId !== comboId)
              : state.combos.map((c) => {
                  if (c.comboId !== comboId) return c
                  const maxCap =
                    c.maxAvailableCombos && c.maxAvailableCombos > 0
                      ? Math.min(c.maxAvailableCombos, 10)
                      : 10
                  return { ...c, count: Math.min(count, maxCap) }
                }),
        })),

      removeCombo: (comboId) =>
        set((state) => ({
          combos: state.combos.filter((c) => c.comboId !== comboId),
        })),

      replaceCombos: (combos) =>
        set({ combos }),

      clearCart: () =>
        set({ items: [], combos: [], clientRef: createClientRef() }),

      resetClientRef: () =>
        set({ clientRef: createClientRef() }),
    }),
    {
      name: 'tazatokri-cart',
    },
  ),
)
