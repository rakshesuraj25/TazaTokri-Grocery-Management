import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  LayoutGrid,
  MessageCircle,
  PackageX,
  Printer,
  Table2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { useVegetableName } from '@/hooks/useVegetableName'
import { useAuthStore } from '@/features/auth/store'
import { useStaffCatalog, useToggleAvailability } from '@/features/catalog/hooks'
import { ProductsTabs } from '@/features/catalog/components/ProductsTabs'
import { matchesVegetableSearch } from '@/features/catalog/shopHelpers'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { isLowStock } from '@/lib/businessRules'
import { todayIST } from '@/lib/dates'
import { dec } from '@/lib/money'
import { AdjustmentDialog, WastageDialog } from '../components/StockModals'
import { StockMovementsSheet } from '../components/StockMovementsSheet'
import { StockToolbar, type StockFilter, type StockSort } from '../components/StockToolbar'
import { StockListView } from '../components/StockListView'
import { buildWhatsAppRestockText } from '../restockHelpers'

function safeStockDec(value: string | number | null | undefined) {
  try {
    return dec(value)
  } catch {
    return dec(0)
  }
}

export default function StockPage() {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const user = useAuthStore((s) => s.user)
  const isOwner = Boolean(user?.roles.includes('OWNER'))

  const catalog = useStaffCatalog()
  const toggleAvail = useToggleAvailability()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StockFilter>('all')
  const [category, setCategory] = useState<string>('ALL')
  const [sort, setSort] = useState<StockSort>('name')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [wastageTarget, setWastageTarget] = useState<StaffCatalogItem | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<StaffCatalogItem | null>(null)
  const [movementsTarget, setMovementsTarget] = useState<StaffCatalogItem | null>(null)

  const rawItems = useMemo(
    () => (Array.isArray(catalog.data) ? catalog.data : []),
    [catalog.data],
  )

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const item of rawItems) {
      if (item.category) set.add(item.category)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rawItems])

  const summary = useMemo(() => {
    let inStockCount = 0
    let lowCount = 0
    let outCount = 0
    for (const item of rawItems) {
      const s = safeStockDec(item.stock)
      if (s.lte(0)) {
        outCount += 1
      } else if (isLowStock(s, item.baseUnit)) {
        lowCount += 1
        inStockCount += 1
      } else {
        inStockCount += 1
      }
    }
    return {
      total: rawItems.length,
      inStock: inStockCount,
      low: lowCount,
      out: outCount,
    }
  }, [rawItems])

  const filtered = useMemo(() => {
    const list = rawItems.filter((item) => {
      const s = safeStockDec(item.stock)
      if (category !== 'ALL' && item.category !== category) return false
      if (filter === 'out' && s.gt(0)) return false
      if (filter === 'low' && !isLowStock(s, item.baseUnit)) return false
      if (filter === 'in_stock' && s.lte(0)) return false
      if (filter === 'available' && !item.available) return false
      return matchesVegetableSearch(item, search)
    })
    return [...list].sort((a, b) => {
      if (sort === 'stockAsc') return safeStockDec(a.stock).cmp(safeStockDec(b.stock))
      if (sort === 'stockDesc') return safeStockDec(b.stock).cmp(safeStockDec(a.stock))
      return name(a).localeCompare(name(b))
    })
  }, [rawItems, category, search, filter, sort, name])

  const restockText = useMemo(
    () => buildWhatsAppRestockText(rawItems, todayIST()),
    [rawItems],
  )

  const handleToggleAvail = (id: string | number, value: boolean) => {
    toggleAvail.mutate(
      { id, value },
      {
        onSuccess: () => {
          toast.success(
            value
              ? t('staff.sale.markedAvailable', { defaultValue: 'Marked available today' })
              : t('staff.sale.markedUnavailable', { defaultValue: 'Marked unavailable today' }),
            {
              duration: 5000,
              action: {
                label: t('common.undo', { defaultValue: 'Undo' }),
                onClick: () => toggleAvail.mutate({ id, value: !value }),
              },
            },
          )
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title={t('staff.stock.title')}
        count={rawItems.length}
        breadcrumbs={[
          { label: t('staff.groups.products', { defaultValue: 'Products' }), to: '/staff/catalog' },
          { label: t('staff.stock.title') },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="rounded-full">
              <Printer className="size-4" />
              {t('common.print', { defaultValue: 'Print' })}
            </Button>
            <Button variant="outline" size="sm" asChild className="rounded-full">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(restockText)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" />
                {t('staff.stock.whatsappRestock', { defaultValue: 'WhatsApp restock list' })}
              </a>
            </Button>
            <div className="bg-muted inline-flex rounded-full p-0.5">
              <Button
                type="button"
                size="sm"
                variant={view === 'cards' ? 'default' : 'ghost'}
                onClick={() => setView('cards')}
                aria-label="Cards view"
                className="rounded-full"
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === 'table' ? 'default' : 'ghost'}
                onClick={() => setView('table')}
                aria-label="Table view"
                className="rounded-full"
              >
                <Table2 className="size-4" />
              </Button>
            </div>
          </div>
        }
      />

      <div className="print:hidden">
        <ProductsTabs />
      </div>

      {/* Inventory overview metrics */}
      {rawItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
          <Stat
            label={t('staff.stock.totalProducts', { defaultValue: 'Total products' })}
            value={summary.total}
            tone="neutral"
            icon={<Boxes className="size-5" />}
          />
          <Stat
            label={t('common.inStock')}
            value={summary.inStock}
            tone="positive"
            icon={<CheckCircle2 className="size-5" />}
          />
          <Stat
            label={t('staff.stock.lowStock')}
            value={summary.low}
            tone={summary.low > 0 ? 'warning' : 'neutral'}
            icon={<AlertTriangle className="size-5" />}
          />
          <Stat
            label={t('common.outOfStock')}
            value={summary.out}
            tone={summary.out > 0 ? 'danger' : 'neutral'}
            icon={<PackageX className="size-5" />}
          />
        </div>
      )}

      <StockToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        categories={categories}
        category={category}
        onCategoryChange={setCategory}
      />

      {catalog.isPending || catalog.isLoading ? (
        <div data-testid="stock-loading" className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : catalog.isError ? (
        <ErrorState onRetry={() => void catalog.refetch()} />
      ) : rawItems.length === 0 ? (
        <EmptyState
          title={t('common.noData')}
          actionLabel={t('common.retry')}
          onAction={() => void catalog.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('common.noResults')}
          actionLabel={search || filter !== 'all' || category !== 'ALL' ? t('common.resetFilters') : undefined}
          onAction={() => {
            setSearch('')
            setFilter('all')
            setCategory('ALL')
          }}
        />
      ) : (
        <StockListView
          items={filtered}
          view={view}
          isOwner={isOwner}
          onToggleAvail={handleToggleAvail}
          onWastage={setWastageTarget}
          onAdjust={setAdjustTarget}
          onMovements={setMovementsTarget}
        />
      )}

      <WastageDialog vegetable={wastageTarget} onClose={() => setWastageTarget(null)} />
      <AdjustmentDialog vegetable={adjustTarget} onClose={() => setAdjustTarget(null)} />
      <StockMovementsSheet
        vegetable={movementsTarget}
        onClose={() => setMovementsTarget(null)}
      />
    </div>
  )
}
