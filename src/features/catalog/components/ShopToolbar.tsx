import { useTranslation } from 'react-i18next'
import { Check, Heart, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getCategoryTheme } from '@/lib/categoryTheme'
import type { ShopSortOption } from '../shopHelpers'

interface ShopToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  sortBy: ShopSortOption
  onSortChange: (value: ShopSortOption) => void
  category: string
  onCategoryChange: (value: string) => void
  inStockOnly: boolean
  onInStockOnlyChange: (value: boolean) => void
  categories: string[]
  favouritesCount: number
}

export function ShopToolbar({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  category,
  onCategoryChange,
  inStockOnly,
  onInStockOnlyChange,
  categories,
  favouritesCount,
}: ShopToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-background/95 sticky top-15 z-30 -mx-4 space-y-3 border-b border-transparent px-4 py-2.5 backdrop-blur-md">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('shop.search')}
            aria-label={t('shop.search')}
            className="bg-card h-11 rounded-full pr-11 pl-10 text-base sm:text-sm"
          />
          {search.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label={t('shop.clearSearch', { defaultValue: 'Clear search' })}
              className="touch-target text-muted-foreground hover:text-foreground absolute top-1/2 right-1 inline-flex -translate-y-1/2 items-center justify-center rounded-full"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        <select
          aria-label={t('common.sort')}
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as ShopSortOption)}
          className="border-input bg-card text-foreground h-11 rounded-full border px-4 text-sm font-medium"
        >
          <option value="name">{t('shop.sortName', { defaultValue: 'Name A-Z' })}</option>
          <option value="priceAsc">
            {t('shop.sortPriceAsc', { defaultValue: 'Price: Low to high' })}
          </option>
          <option value="priceDesc">
            {t('shop.sortPriceDesc', { defaultValue: 'Price: High to low' })}
          </option>
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => {
          const active = category === cat
          const theme = getCategoryTheme(cat === 'ALL' ? null : cat)
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`touch-target inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-bold transition-colors duration-150 ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : `bg-card text-foreground ${theme.borderClass} hover:bg-secondary/50`
              }`}
            >
              {cat !== 'ALL' && (
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${active ? 'bg-primary-foreground' : theme.barClass}`}
                />
              )}
              <span>{cat === 'ALL' ? t('common.all') : cat}</span>
            </button>
          )
        })}

        <button
          type="button"
          aria-pressed={inStockOnly}
          onClick={() => onInStockOnlyChange(!inStockOnly)}
          className={`touch-target inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-bold transition-colors duration-150 ${
            inStockOnly
              ? 'bg-secondary border-primary text-primary'
              : 'bg-card border-border text-foreground hover:bg-secondary/50'
          }`}
        >
          {inStockOnly && <Check className="size-3.5" aria-hidden />}
          <span>{t('common.inStock')}</span>
        </button>

        {favouritesCount > 0 && (
          <button
            type="button"
            onClick={() => onCategoryChange('FAVOURITES')}
            className={`touch-target inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-bold transition-colors duration-150 ${
              category === 'FAVOURITES'
                ? 'bg-tomato border-tomato text-white'
                : 'bg-card border-border text-foreground hover:bg-secondary/50'
            }`}
          >
            <Heart className="size-3.5" aria-hidden />
            <span>{t('shop.favourites', { defaultValue: 'Favourites' })}</span>
          </button>
        )}
      </div>
    </div>
  )
}
