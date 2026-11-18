import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  MessageCircle,
  PackageX,
  Printer,
  Settings2,
  Table2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { useVegetableName } from '@/hooks/useVegetableName'
import { useAuthStore } from '@/features/auth/store'
import { useStaffCatalog, useToggleAvailability } from '@/features/catalog/hooks'
import { ProductsTabs } from '@/features/catalog/components/ProductsTabs'
import { matchesVegetableSearch } from '@/features/catalog/shopHelpers'
import type { StaffCatalogItem } from '@/features/catalog/types'
import {
  DEFAULT_LOW_STOCK_THRESHOLDS,
  getLowStockThresholds,
  isLowStock,
  resetLowStockThresholds,
  setLowStockThresholds,
  type LowStockThresholds,
} from '@/lib/businessRules'
import { todayIST } from '@/lib/dates'
import { dec, formatQty } from '@/lib/money'
import { AdjustmentDialog, WastageDialog } from '../components/StockModals'
import { StockMovementsSheet } from '../components/StockMovementsSheet'
import { StockToolbar, type StockFilter, type StockSort } from '../components/StockToolbar'
import { StockListView } from '../components/StockListView'
import { WastageReportPanel } from '../components/WastageReportPanel'
import { BusinessIntelligencePanel } from '@/features/report/components/BusinessIntelligencePanel'
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
  const [showWastageReport, setShowWastageReport] = useState(false)
  const [showBiPanel, setShowBiPanel] = useState(false)
  const [thresholds, setThresholdsState] = useState<LowStockThresholds>(() =>
    getLowStockThresholds(),
  )
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false)
  const [draftThresholds, setDraftThresholds] = useState<LowStockThresholds>(thresholds)
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

  const { summary, outItems, lowItems } = useMemo(() => {
    let inStockCount = 0
    const outList: StaffCatalogItem[] = []
    const lowList: StaffCatalogItem[] = []

    for (const item of rawItems) {
      const s = safeStockDec(item.stock)
      if (s.lte(0)) {
        outList.push(item)
      } else if (isLowStock(s, item.baseUnit, thresholds)) {
        lowList.push(item)
        inStockCount += 1
      } else {
        inStockCount += 1
      }
    }
    return {
      summary: {
        total: rawItems.length,
        inStock: inStockCount,
        low: lowList.length,
        out: outList.length,
      },
      outItems: outList,
      lowItems: lowList,
    }
  }, [rawItems, thresholds])

  const filtered = useMemo(() => {
    const list = rawItems.filter((item) => {
      const s = safeStockDec(item.stock)
      if (category !== 'ALL' && item.category !== category) return false
      if (filter === 'out' && s.gt(0)) return false
      if (filter === 'low' && !isLowStock(s, item.baseUnit, thresholds)) return false
      if (filter === 'in_stock' && s.lte(0)) return false
      if (filter === 'available' && !item.available) return false
      return matchesVegetableSearch(item, search)
    })
    return [...list].sort((a, b) => {
      if (sort === 'stockAsc') return safeStockDec(a.stock).cmp(safeStockDec(b.stock))
      if (sort === 'stockDesc') return safeStockDec(b.stock).cmp(safeStockDec(a.stock))
      return name(a).localeCompare(name(b))
    })
  }, [rawItems, category, search, filter, sort, name, thresholds])

  const restockText = useMemo(
    () => buildWhatsAppRestockText(rawItems, todayIST()),
    [rawItems],
  )

  const handleSaveThresholds = () => {
    const next = setLowStockThresholds(draftThresholds)
    setThresholdsState(next)
    setThresholdDialogOpen(false)
    toast.success(
      t('staff.stock.thresholdsSaved', { defaultValue: 'Low-stock thresholds updated' }),
    )
  }

  const handleResetThresholds = () => {
    const next = resetLowStockThresholds()
    setThresholdsState(next)
    setDraftThresholds(next)
    setThresholdDialogOpen(false)
    toast.success(
      t('staff.stock.thresholdsReset', {
        defaultValue: 'Low-stock thresholds reset to defaults',
      }),
    )
  }

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
            <Button
              type="button"
              variant={showWastageReport ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowWastageReport((v) => !v)}
              className="rounded-full"
            >
              <ClipboardList className="size-4" />
              {t('staff.stock.wastageReportTitle', { defaultValue: 'Wastage Report' })}
            </Button>
            <Button
              type="button"
              variant={showBiPanel ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowBiPanel((v) => !v)}
              className="rounded-full"
            >
              <Boxes className="size-4" />
              {t('bi.freshnessAndValuationBtn', {
                defaultValue: 'Freshness & Valuation',
              })}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDraftThresholds(thresholds)
                setThresholdDialogOpen(true)
              }}
              className="rounded-full"
            >
              <Settings2 className="size-4" />
              {t('staff.stock.thresholdsBtn', { defaultValue: 'Thresholds' })}
            </Button>
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

      {/* Actionable Restock Alert Banner when products are Out of Stock or Low Stock */}
      {(outItems.length > 0 || lowItems.length > 0) && (
        <div
          role="region"
          aria-label={t('staff.dashboard.stockAlertsTitle', {
            defaultValue: 'Low & out-of-stock alerts',
          })}
          data-testid="restock-alert-banner"
          className="bg-turmeric-light/40 border-turmeric/50 space-y-2.5 rounded-2xl border p-4 print:hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-warning size-4 shrink-0" aria-hidden />
              <p className="font-display text-sm font-bold">
                {t('staff.stock.restockNeededTitle', {
                  defaultValue: 'Restock attention needed',
                })}
                :{' '}
                <span className="font-normal">
                  {outItems.length} {t('common.outOfStock').toLowerCase()}, {lowItems.length}{' '}
                  {t('staff.stock.lowStock').toLowerCase()}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {outItems.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={filter === 'out' ? 'default' : 'outline'}
                  onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}
                  className="h-7 rounded-full text-xs"
                >
                  {t('common.outOfStock')} ({outItems.length})
                </Button>
              )}
              {lowItems.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={filter === 'low' ? 'default' : 'outline'}
                  onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
                  className="h-7 rounded-full text-xs"
                >
                  {t('staff.stock.lowStock')} ({lowItems.length})
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {outItems.slice(0, 6).map((v) => (
              <Badge key={`alert-out-${v.id}`} variant="destructive">
                {name(v)} (0 {v.baseUnit})
              </Badge>
            ))}
            {lowItems.slice(0, 6).map((v) => (
              <Badge key={`alert-low-${v.id}`} variant="warning">
                {name(v)} ({formatQty(v.stock)} {v.baseUnit})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {showWastageReport && (
        <div className="print:hidden">
          <WastageReportPanel />
        </div>
      )}

      {showBiPanel && (
        <div className="print:hidden">
          <BusinessIntelligencePanel />
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
          thresholds={thresholds}
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

      <Dialog open={thresholdDialogOpen} onOpenChange={setThresholdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('staff.stock.thresholdsTitle', {
                defaultValue: 'Low-Stock Warning Thresholds',
              })}
            </DialogTitle>
            <DialogDescription>
              {t('staff.stock.thresholdsDesc', {
                defaultValue:
                  'Products at or below these quantities (and above 0) are highlighted as low stock.',
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="threshold-kg">KG threshold</Label>
              <Input
                id="threshold-kg"
                type="number"
                min="1"
                step="0.5"
                value={draftThresholds.KG}
                onChange={(e) =>
                  setDraftThresholds((prev) => ({
                    ...prev,
                    KG: Math.max(0.5, Number(e.target.value) || DEFAULT_LOW_STOCK_THRESHOLDS.KG),
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="threshold-bunch">BUNCH threshold</Label>
              <Input
                id="threshold-bunch"
                type="number"
                min="1"
                step="1"
                value={draftThresholds.BUNCH}
                onChange={(e) =>
                  setDraftThresholds((prev) => ({
                    ...prev,
                    BUNCH: Math.max(1, Number(e.target.value) || DEFAULT_LOW_STOCK_THRESHOLDS.BUNCH),
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="threshold-piece">PIECE threshold</Label>
              <Input
                id="threshold-piece"
                type="number"
                min="1"
                step="1"
                value={draftThresholds.PIECE}
                onChange={(e) =>
                  setDraftThresholds((prev) => ({
                    ...prev,
                    PIECE: Math.max(1, Number(e.target.value) || DEFAULT_LOW_STOCK_THRESHOLDS.PIECE),
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={handleResetThresholds}>
              {t('common.reset', { defaultValue: 'Reset defaults' })}
            </Button>
            <Button type="button" variant="outline" onClick={() => setThresholdDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleSaveThresholds}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
