import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Database, FolderTree, ImageIcon, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { useAuthStore } from '@/features/auth/store'
import { toApiError } from '@/lib/api'
import { dec } from '@/lib/money'
import { ProductsTabs } from '../components/ProductsTabs'
import { CatalogToolbar, type CatalogStatusFilter } from '../components/CatalogToolbar'
import { CatalogCardsGrid } from '../components/CatalogCardsGrid'
import { CatalogImportDialog } from '../components/CatalogImportDialog'
import { QuickPriceDialog, type QuickPriceTarget } from '../components/QuickPriceDialog'
import { deriveProductVisibility } from '../visibility'
import { matchesVegetableSearch } from '../shopHelpers'
import { usePhotoAvailability } from '../usePhotoAvailability'
import type { SeedCatalogSummary } from '../defaultCatalog'
import type { StaffCatalogItem } from '../types'
import {
  useSeedCatalog,
  useStaffCatalog,
  useToggleActive,
  useToggleAvailability,
  useVegetables,
} from '../hooks'

export default function CatalogPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const isOwner = Boolean(user?.roles.includes('OWNER'))

  const vegetables = useVegetables()
  const staffCatalog = useStaffCatalog()
  const photoTargets = useMemo(
    () => (isOwner ? (vegetables.data ?? []) : []),
    [isOwner, vegetables.data],
  )
  const photoStatuses = usePhotoAvailability(photoTargets)
  const toggleAvail = useToggleAvailability()
  const toggleActive = useToggleActive()
  const seedCatalog = useSeedCatalog()

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<CatalogStatusFilter>('all')
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [lastImportSummary, setLastImportSummary] = useState<SeedCatalogSummary | null>(null)
  const [priceTarget, setPriceTarget] = useState<QuickPriceTarget | null>(null)

  const staffByVegId = useMemo(() => {
    const map = new Map<string, StaffCatalogItem>()
    for (const item of staffCatalog.data ?? []) {
      map.set(String(item.id), item)
    }
    return map
  }, [staffCatalog.data])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const v of vegetables.data ?? []) set.add(v.categoryName)
    return ['ALL', ...Array.from(set)]
  }, [vegetables.data])

  const hiddenStockedCount = useMemo(() => {
    let count = 0
    for (const v of vegetables.data ?? []) {
      const staffItem = staffByVegId.get(String(v.id))
      const vis = deriveProductVisibility({
        active: v.active,
        available: v.available,
        pricePerUnit: staffItem?.pricePerUnit ?? null,
        stock: staffItem?.stock ?? '0',
      })
      if (vis.code === 'HIDDEN_STOCKED') count++
    }
    return count
  }, [vegetables.data, staffByVegId])

  const filtered = useMemo(() => {
    return (vegetables.data ?? []).filter((v) => {
      if (catFilter !== 'ALL' && v.categoryName !== catFilter) return false
      const staffItem = staffByVegId.get(String(v.id))
      if (statusFilter === 'available' && !v.available) return false
      if (statusFilter === 'hidden_stocked') {
        const vis = deriveProductVisibility({
          active: v.active,
          available: v.available,
          pricePerUnit: staffItem?.pricePerUnit ?? null,
          stock: staffItem?.stock ?? '0',
        })
        if (vis.code !== 'HIDDEN_STOCKED') return false
      }
      if (statusFilter === 'out' && dec(staffItem?.stock ?? '0').gt(0)) return false
      if (statusFilter === 'noprice' && staffItem?.pricePerUnit !== null) return false
      return matchesVegetableSearch(v, search)
    })
  }, [vegetables.data, catFilter, statusFilter, staffByVegId, search])

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

  const handleConfirmSeedCatalog = () => {
    seedCatalog.mutate(undefined, {
      onSuccess: (summary) => {
        setLastImportSummary(summary)
        setImportDialogOpen(false)
        toast.success(
          `Import complete: ${summary.vegetablesAdded} created, ${summary.vegetablesReused} skipped`,
        )
      },
      onError: (err) => {
        toast.error(toApiError(err).message)
      },
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title={t('staff.catalog.title')}
        count={vegetables.data?.length}
        breadcrumbs={[
          { label: t('staff.groups.products', { defaultValue: 'Products' }) },
          { label: t('staff.catalog.title') },
        ]}
        actions={
          <>
            {isOwner && (
              <>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to="/staff/catalog/images">
                    <ImageIcon className="size-4" aria-hidden />
                    {t('staff.catalog.manageImages', { defaultValue: 'Images' })}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  loading={seedCatalog.isPending}
                  onClick={() => setImportDialogOpen(true)}
                >
                  <Database className="size-4" />
                  Import 36 Vegetables
                </Button>
              </>
            )}
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/staff/categories">
                <FolderTree className="size-4" />
                {t('staff.catalog.categories')}
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/staff/catalog/new">
                <Plus className="size-4" />
                {t('staff.catalog.addVeg')}
              </Link>
            </Button>
          </>
        }
      />

      <ProductsTabs />

      {lastImportSummary && (
        <div
          role="status"
          data-testid="import-summary-banner"
          className="bg-secondary/60 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs"
        >
          <div>
            <span className="font-bold">Catalog import summary:</span>{' '}
            <span>
              Created: <strong>{lastImportSummary.vegetablesAdded}</strong> · Skipped:{' '}
              <strong>{lastImportSummary.vegetablesReused}</strong>
              {lastImportSummary.pricesCreated > 0
                ? ` · Sample prices added: ${lastImportSummary.pricesCreated}`
                : ' · No prices or stock added'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLastImportSummary(null)}
            className="text-muted-foreground hover:text-foreground font-semibold"
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {hiddenStockedCount > 0 && statusFilter !== 'hidden_stocked' && (
        <div
          role="status"
          className="border-turmeric/50 bg-turmeric-light/30 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs"
        >
          <span>
            <strong>{hiddenStockedCount}</strong>{' '}
            {hiddenStockedCount === 1
              ? 'stocked item is hidden from the customer store'
              : 'stocked items are hidden from the customer store'}{' '}
            (missing selling price or Available Today is off).
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStatusFilter('hidden_stocked')}
            className="h-7 rounded-full px-3 text-xs"
          >
            Show hidden stocked
          </Button>
        </div>
      )}

      <CatalogToolbar
        search={search}
        onSearchChange={setSearch}
        categories={categories}
        catFilter={catFilter}
        onCatFilterChange={setCatFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {vegetables.isPending || vegetables.isLoading ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : vegetables.isError ? (
        <ErrorState onRetry={() => void vegetables.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('common.noResults')}
          actionLabel={
            search || catFilter !== 'ALL' || statusFilter !== 'all'
              ? t('common.resetFilters')
              : undefined
          }
          onAction={() => {
            setSearch('')
            setCatFilter('ALL')
            setStatusFilter('all')
          }}
        />
      ) : (
        <CatalogCardsGrid
          items={filtered}
          staffByVegId={staffByVegId}
          photoStatuses={photoStatuses}
          isOwner={isOwner}
          onToggleAvail={handleToggleAvail}
          onToggleActive={(id, value) => toggleActive.mutate({ id, value })}
          onQuickPrice={setPriceTarget}
        />
      )}

      <QuickPriceDialog target={priceTarget} onClose={() => setPriceTarget(null)} />

      <CatalogImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        isPending={seedCatalog.isPending}
        onConfirm={handleConfirmSeedCatalog}
      />
    </div>
  )
}
