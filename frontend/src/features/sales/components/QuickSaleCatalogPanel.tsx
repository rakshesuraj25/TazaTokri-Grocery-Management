import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { dec } from '@/lib/money'
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
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [highlightedIdx, setHighlightedIdx] = useState(0)

  const clampedIdx = filtered.length > 0 ? Math.min(highlightedIdx, filtered.length - 1) : 0

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (filtered.length === 0) return
      e.preventDefault()
      setHighlightedIdx((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      if (filtered.length === 0) return
      e.preventDefault()
      setHighlightedIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      const targetItem = filtered[clampedIdx]
      if (!targetItem) return
      const hasStock = dec(targetItem.stock).gt(0)
      const hasPrice =
        targetItem.pricePerUnit !== null &&
        targetItem.pricePerUnit !== undefined &&
        targetItem.pricePerUnit !== ''
      if (hasStock && hasPrice) {
        e.preventDefault()
        onAddQty(targetItem, '1')
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onSearchChange('')
      setHighlightedIdx(0)
      searchInputRef.current?.blur()
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            ref={searchInputRef}
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => {
              setHighlightedIdx(0)
              onSearchChange(e.target.value)
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('staff.sale.searchVeg')}
            aria-label={t('staff.sale.searchVeg')}
            className="bg-card pr-10 pl-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setHighlightedIdx(0)
                onSearchChange('')
              }}
              aria-label={t('common.clear', { defaultValue: 'Clear' })}
              className="touch-target text-muted-foreground hover:text-foreground absolute top-1/2 right-1 inline-flex -translate-y-1/2 items-center justify-center rounded-full"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <p className="text-muted-foreground hidden text-[11px] sm:block">
          Shortcuts: <kbd className="bg-muted rounded px-1 py-0.5 font-mono">/</kbd> search ·{' '}
          <kbd className="bg-muted rounded px-1 py-0.5 font-mono">↑↓</kbd> select ·{' '}
          <kbd className="bg-muted rounded px-1 py-0.5 font-mono">Enter</kbd> add ·{' '}
          <kbd className="bg-muted rounded px-1 py-0.5 font-mono">Esc</kbd> clear ·{' '}
          <kbd className="bg-muted rounded px-1 py-0.5 font-mono">Ctrl+Enter</kbd> payment
        </p>
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
          {filtered.map((item, idx) => {
            const line = syncedLines.find((l) => String(l.item.id) === String(item.id))
            const isHighlighted = search.trim().length > 0 && idx === clampedIdx
            return (
              <div
                key={String(item.id)}
                className={isHighlighted ? 'ring-primary/60 rounded-2xl ring-2' : undefined}
              >
                <QuickSaleTile
                  item={item}
                  inBillQty={line?.quantity}
                  onAddQty={onAddQty}
                  onToggleAvailable={onToggleAvailable}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
