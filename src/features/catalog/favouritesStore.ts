import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavouritesState {
  ids: string[]
  toggleFavourite: (vegetableId: string | number) => void
  isFavourite: (vegetableId: string | number) => boolean
}

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggleFavourite: (vegetableId) => {
        const key = String(vegetableId)
        set((state) => ({
          ids: state.ids.includes(key)
            ? state.ids.filter((id) => id !== key)
            : [...state.ids, key],
        }))
      },
      isFavourite: (vegetableId) => get().ids.includes(String(vegetableId)),
    }),
    {
      name: 'tazatokri-favourites',
    },
  ),
)
