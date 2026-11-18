import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCategoryTheme } from '@/lib/categoryTheme'

export type StockFilter = 'all' | 'in_stock' | 'low' | 'out' | 'available'
export type StockSort = 'name' | 'stockAsc' | 'stockDesc'

interface StockToolbarProps {
  search: string
  onSearchChange: (val: string) => void
  filter: StockFilter
  onFilterChange: (val: StockFilter) => void
  sort: StockSort
  onSortChange: (val: StockSort) => void
  categories: string[]
  category: string
  onCategoryChange: (cat: string) => void
}

export function StockToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  categories,
  category,
  onCategoryChange,
}: StockToolbarProps) {
  const { t } = useTranslation()

  const filters: [StockFilter, string][] = [
    ['all', t('common.all')],
    ['in_stock', t('common.inStock')],
    ['low', t('staff.stock.lowStock')],
    ['out', t('common.outOfStock')],
    ['available', t('staff.stock.availableToggle')],
  ]

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('staff.stock.searchVeg')}
            aria-label={t('staff.stock.searchVeg')}
            className="bg-card pr-10 pl-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label={t('common.clear', { defaultValue: 'Clear' })}
              className="touch-target text-muted-foreground hover:text-foreground absolute top-1/2 right-1 inline-flex -translate-y-1/2 items-center justify-center rounded-full"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <select
          aria-label={t('common.sort', { defaultValue: 'Sort' })}
          value={sort}
          onChange={(e) => onSortChange(e.target.value as StockSort)}
          className="border-input bg-card h-11 rounded-full border px-4 text-sm font-medium"
        >
          <option value="name">{t('staff.stock.sortName', { defaultValue: 'Sort: Name' })}</option>
          <option value="stockAsc">
            {t('staff.stock.sortLowFirst', { defaultValue: 'Sort: Stock low to high' })}
          </option>
          <option value="stockDesc">
            {t('staff.stock.sortHighFirst', { defaultValue: 'Sort: Stock high to low' })}
          </option>
        </select>
      </div>

      {categories.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => onCategoryChange('ALL')}
            aria-pressed={category === 'ALL'}
            className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-xs font-bold transition-colors ${
              category === 'ALL'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border bg-card text-foreground hover:bg-secondary/70'
            }`}
          >
            {t('staff.stock.allCategories', { defaultValue: 'All categories' })}
          </button>
          {categories.map((cat) => {
            const theme = getCategoryTheme(cat)
            const active = category === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                aria-pressed={active}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border bg-card text-foreground hover:bg-secondary/70'
                }`}
              >
                <span aria-hidden className={`size-2 rounded-full ${active ? 'bg-primary-foreground' : theme.barClass}`} />
                <span>{cat}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {filters.map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? 'turmeric' : 'outline'}
            onClick={() => onFilterChange(key)}
            className="rounded-full"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}
