import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { History, LayoutGrid, Monitor, Search, Sparkles, Table2, Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { StatusBadge } from '@/components/StatusBadge'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { useStaffCatalog } from '@/features/catalog/hooks'
import { ProductsTabs } from '@/features/catalog/components/ProductsTabs'
import { matchesVegetableSearch } from '@/features/catalog/shopHelpers'
import type { StaffCatalogItem } from '@/features/catalog/types'
import {
  PriceHistorySheet,
  PriceSuggestionDialog,
  SetPriceDialog,
} from '../components/PricingDialogs'

export default function PricingPage() {
  const { t } = useTranslation()
  const { name, subtitle } = useVegetableName()
  const catalog = useStaffCatalog()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('ALL')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [editTarget, setEditTarget] = useState<StaffCatalogItem | null>(null)
  const [suggestTarget, setSuggestTarget] = useState<StaffCatalogItem | null>(null)
  const [historyTarget, setHistoryTarget] = useState<StaffCatalogItem | null>(null)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const item of catalog.data ?? []) set.add(item.category)
    return ['ALL', ...Array.from(set)]
  }, [catalog.data])

  const filtered = useMemo(() => {
    return (catalog.data ?? []).filter((v) => {
      if (category !== 'ALL' && v.category !== category) return false
      return matchesVegetableSearch(v, search)
    })
  }, [catalog.data, category, search])

  const priceSummary = useMemo(() => {
    const items = catalog.data ?? []
    const priced = items.filter((v) => v.pricePerUnit !== null && v.pricePerUnit !== '').length
    const unpriced = items.length - priced
    const available = items.filter((v) => v.available).length
    return { total: items.length, priced, unpriced, available }
  }, [catalog.data])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title={t('staff.pricing.title')}
        count={catalog.data?.length}
        breadcrumbs={[
          { label: t('staff.groups.products', { defaultValue: 'Products' }), to: '/staff/catalog' },
          { label: t('staff.pricing.title') },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-muted inline-flex rounded-full p-0.5">
              <Button
                type="button"
                size="sm"
                variant={view === 'cards' ? 'default' : 'ghost'}
                onClick={() => setView('cards')}
                className="rounded-full"
              >
                <LayoutGrid className="size-4" />
                {t('common.cardsView', { defaultValue: 'Cards' })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === 'table' ? 'default' : 'ghost'}
                onClick={() => setView('table')}
                className="rounded-full"
              >
                <Table2 className="size-4" />
                {t('common.tableView', { defaultValue: 'Table' })}
              </Button>
            </div>
            <Button variant="outline" size="sm" asChild className="rounded-full">
              <Link to="/display/prices">
                <Monitor className="size-4" />
                {t('staff.pricing.chalkboardBoard', { defaultValue: 'Chalkboard board' })}
              </Link>
            </Button>
          </div>
        }
      />

      <ProductsTabs />

      {(catalog.data ?? []).length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label={t('staff.stock.totalProducts', { defaultValue: 'Total products' })}
            value={priceSummary.total}
            tone="neutral"
            icon={<Tag className="size-5" />}
          />
          <Stat
            label={t('pricing.priceSet')}
            value={priceSummary.priced}
            tone="positive"
            icon={<Sparkles className="size-5" />}
          />
          <Stat
            label={t('pricing.priceNotSet')}
            value={priceSummary.unpriced}
            tone={priceSummary.unpriced > 0 ? 'danger' : 'neutral'}
            icon={<Tag className="size-5" />}
          />
        </div>
      )}

      <div className="space-y-2.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-3.5 left-3 size-4" />
          <Input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('staff.sale.searchVeg')}
            aria-label={t('staff.sale.searchVeg')}
            className="pr-10 pl-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('common.clear', { defaultValue: 'Clear' })}
              className="touch-target text-muted-foreground hover:text-foreground absolute top-0.5 right-0.5 inline-flex items-center justify-center rounded-lg"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const theme = cat === 'ALL' ? null : getCategoryTheme(cat)
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`touch-target inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  category === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {theme && (
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${
                      category === cat ? 'bg-primary-foreground' : theme.barClass
                    }`}
                  />
                )}
                <span>{cat === 'ALL' ? t('common.all') : cat}</span>
              </button>
            )
          })}
        </div>
      </div>

      {catalog.isPending || catalog.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : catalog.isError ? (
        <ErrorState onRetry={() => void catalog.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('common.noResults')}
          action={
            search || category !== 'ALL' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setCategory('ALL')
                }}
              >
                {t('common.resetFilters', { defaultValue: 'Clear filters' })}
              </Button>
            ) : undefined
          }
        />
      ) : view === 'table' ? (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2.5">{t('staff.catalog.nameEn', { defaultValue: 'Vegetable' })}</th>
                <th className="px-3 py-2.5">{t('staff.pricing.todayPrice', { defaultValue: 'Price' })}</th>
                <th className="px-3 py-2.5 text-right">{t('common.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((item) => {
                const unitLabel = t(`units.${item.baseUnit}`, { defaultValue: item.baseUnit })
                return (
                  <tr key={String(item.id)}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <VegetableImage
                          nameEn={item.nameEn}
                          imageUrl={item.imageUrl}
                          category={item.category}
                          alt={name(item)}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold">{name(item)}</p>
                          {subtitle(item) && (
                            <p className="text-muted-foreground text-xs">{subtitle(item)}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.pricePerUnit !== null ? (
                        <span className="font-display font-bold">
                          <MoneyDisplay value={item.pricePerUnit} /> / {unitLabel}
                        </span>
                      ) : (
                        <StatusBadge kind="price" status="NOT_SET" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" onClick={() => setEditTarget(item)}>
                          {t('staff.pricing.setPrice')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setSuggestTarget(item)}>
                          {t('staff.pricing.suggest')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setHistoryTarget(item)}>
                          <History className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {filtered.map((item) => {
            const unitLabel = t(`units.${item.baseUnit}`, { defaultValue: item.baseUnit })
            return (
              <Card
                key={String(item.id)}
                className={`flex flex-col justify-between gap-3 p-4 ${
                  item.pricePerUnit === null ? 'border-turmeric/60 bg-turmeric-light/15' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <VegetableImage
                      nameEn={item.nameEn}
                      imageUrl={item.imageUrl}
                      category={item.category}
                      alt={name(item)}
                      size="md"
                    />
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-display break-words text-lg leading-snug font-bold">
                        {name(item)}
                      </h2>
                      {subtitle(item) && (
                        <p className="text-muted-foreground break-words text-xs">{subtitle(item)}</p>
                      )}
                      <div>
                        {item.pricePerUnit !== null ? (
                          <span className="font-display inline-flex items-baseline gap-1 rounded-lg bg-[#122017] px-3 py-1 text-base font-extrabold text-amber-200 dark:bg-slate-800">
                            <MoneyDisplay value={item.pricePerUnit} />
                            <span className="text-xs font-medium text-amber-100/80">
                              / {unitLabel}
                            </span>
                          </span>
                        ) : (
                          <Badge variant="warning">{t('staff.sale.noPriceBadge')}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                  <Button size="sm" onClick={() => setEditTarget(item)}>
                    <Tag className="size-3.5" />
                    {t('staff.pricing.setPrice')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSuggestTarget(item)}
                  >
                    <Sparkles className="size-3.5" />
                    {t('staff.pricing.suggest')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setHistoryTarget(item)}
                  >
                    <History className="size-3.5" />
                    {t('staff.pricing.priceHistory')}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <SetPriceDialog vegetable={editTarget} onClose={() => setEditTarget(null)} />
      <PriceSuggestionDialog
        vegetable={suggestTarget}
        onClose={() => setSuggestTarget(null)}
      />
      <PriceHistorySheet
        vegetable={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  )
}
