import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { QuickSaleTile } from './QuickSaleTile'
import type { BillLine } from './QuickSaleBill'

interface QuickSaleCatalogPanelProps {
  search: string
  onSearchChange: (val: string) => void
  category: string
  onCategoryChange: (val: string) => void
  categories: string[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  filtered: StaffCatalogItem[]
  syncedLines: BillLine[]
  onAddQty: (item: StaffCatalogItem, baseQty: string) => void
  onToggleAvailable: (id: string | number, value: boolean) => void
}

export function QuickSaleCatalogPanel({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  isLoading,
  isError,
  onRetry,
  filtered,
  syncedLines,
  onAddQty,
  onToggleAvailable,
}: QuickSaleCatalogPanelProps) {
  const { t } = useTranslation()

  return (
    <div className="min-w-0 space-y-3">
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
        {categories.map((cat) => {
          const theme = cat === 'ALL' ? null : getCategoryTheme(cat)
          const active = category === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
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
              <span>{cat === 'ALL' ? t('common.all') : cat}</span>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3.5 min-[420px]:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('common.noResults')}
          action={
            search || category !== 'ALL' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onSearchChange('')
                  onCategoryChange('ALL')
                }}
              >
                {t('common.resetFilters', { defaultValue: 'Clear filters' })}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 min-[420px]:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const line = syncedLines.find((l) => String(l.item.id) === String(item.id))
            return (
              <QuickSaleTile
                key={String(item.id)}
                item={item}
                inBillQty={line?.quantity}
                onAddQty={onAddQty}
                onToggleAvailable={onToggleAvailable}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
