import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getCategoryTheme } from '@/lib/categoryTheme'

export type CatalogStatusFilter = 'all' | 'available' | 'out' | 'noprice'

interface CatalogToolbarProps {
  search: string
  onSearchChange: (val: string) => void
  categories: string[]
  catFilter: string
  onCatFilterChange: (cat: string) => void
  statusFilter: CatalogStatusFilter
  onStatusFilterChange: (status: CatalogStatusFilter) => void
}

export function CatalogToolbar({
  search,
  onSearchChange,
  categories,
  catFilter,
  onCatFilterChange,
  statusFilter,
  onStatusFilterChange,
}: CatalogToolbarProps) {
  const { t } = useTranslation()

  const statusChips: Array<{ key: CatalogStatusFilter; label: string }> = [
    { key: 'all', label: t('common.all') },
    { key: 'available', label: t('staff.catalog.availableToggle') },
    { key: 'out', label: t('common.outOfStock') },
    { key: 'noprice', label: t('staff.catalog.filterNoPrice', { defaultValue: 'No price' }) },
  ]

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <Input
          type="search"
          autoComplete="off"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('staff.sale.searchVeg')}
          aria-label={t('staff.sale.searchVeg')}
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

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((c) => {
          const theme = c === 'ALL' ? null : getCategoryTheme(c)
          const active = catFilter === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => onCatFilterChange(c)}
              className={`touch-target inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-foreground hover:bg-secondary/50'
              }`}
            >
              {theme && (
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${active ? 'bg-primary-foreground' : theme.barClass}`}
                />
              )}
              <span>{c === 'ALL' ? t('common.all') : c}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {statusChips.map((chip) => (
          <Button
            key={chip.key}
            type="button"
            size="sm"
            variant={statusFilter === chip.key ? 'turmeric' : 'outline'}
            onClick={() => onStatusFilterChange(chip.key)}
            className="rounded-full"
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
