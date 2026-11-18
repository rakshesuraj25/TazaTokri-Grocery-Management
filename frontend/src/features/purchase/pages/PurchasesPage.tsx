import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutGrid,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Table2,
  TrendingDown,
  Truck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/DataTable'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { useAuthStore } from '@/features/auth/store'
import { fmtDate } from '@/lib/dates'
import { formatMoney, formatQty, sumMoney } from '@/lib/money'
import { usePurchases } from '../hooks'

export default function PurchasesPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const isOwner = Boolean(user?.roles.includes('OWNER'))
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'cards' | 'table'>('cards')

  const purchases = usePurchases(page, isOwner)
  const list = useMemo(() => purchases.data ?? [], [purchases.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (p) =>
        p.supplierName.toLowerCase().includes(q) ||
        p.purchaseDate.includes(q) ||
        p.items.some((item) => item.vegetableName.toLowerCase().includes(q)),
    )
  }, [list, search])

  const metrics = useMemo(() => {
    const totalSpend = sumMoney(list.map((p) => p.totalCost))
    const uniqueSuppliers = new Set(list.map((p) => String(p.supplierId))).size
    const totalItems = list.reduce((sum, p) => sum + p.items.length, 0)
    return { totalSpend, uniqueSuppliers, totalItems }
  }, [list])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title={t('staff.purchase.purchasesTitle')}
        count={isOwner ? list.length : undefined}
        breadcrumbs={[
          { label: t('staff.groups.buy', { defaultValue: 'Buy' }) },
          { label: t('staff.purchase.purchasesTitle') },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/staff/suppliers">
                <Truck className="size-4" aria-hidden />
                {t('staff.purchase.suppliersTitle')}
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/staff/purchases/new">
                <Plus className="size-4" aria-hidden />
                {t('staff.purchase.newPurchase')}
              </Link>
            </Button>
            {isOwner && (
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
            )}
          </div>
        }
      />

      {!isOwner ? (
        <EmptyState
          title={t('staff.purchase.ownerListHint')}
          action={
            <Button asChild className="rounded-full">
              <Link to="/staff/purchases/new">{t('staff.purchase.newPurchase')}</Link>
            </Button>
          }
        />
      ) : purchases.isPending || purchases.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : purchases.isError ? (
        <ErrorState onRetry={() => void purchases.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label={t('staff.purchase.purchasesTitle')}
              value={list.length}
              tone="neutral"
              icon={<ShoppingBag className="size-5" />}
            />
            <Stat
              label={t('staff.purchase.totalCost')}
              value={formatMoney(metrics.totalSpend)}
              tone="danger"
              icon={<TrendingDown className="size-5" />}
            />
            <Stat
              label={t('staff.purchase.suppliersTitle')}
              value={metrics.uniqueSuppliers}
              tone="positive"
              icon={<Truck className="size-5" />}
            />
            <Stat
              label={t('orders.items')}
              value={metrics.totalItems}
              tone="warning"
              icon={<Package className="size-5" />}
            />
          </div>

          {list.length > 0 && (
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                type="search"
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('staff.purchase.searchHint', {
                  defaultValue: 'Search supplier or vegetable...',
                })}
                aria-label={t('common.search')}
                className="bg-card pr-10 pl-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label={t('common.clear', { defaultValue: 'Clear' })}
                  className="touch-target text-muted-foreground hover:text-foreground absolute top-1/2 right-1 inline-flex -translate-y-1/2 items-center justify-center rounded-full"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}

          {list.length === 0 ? (
            <EmptyState
              title={t('common.noData')}
              action={
                <Button asChild className="rounded-full">
                  <Link to="/staff/purchases/new">{t('staff.purchase.newPurchase')}</Link>
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={t('common.noResults')}
              actionLabel={t('common.resetFilters')}
              onAction={() => setSearch('')}
            />
          ) : view === 'table' ? (
            <DataTable aria-label={t('staff.purchase.purchasesTitle')}>
              <thead className="bg-muted/50 text-left text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">{t('staff.purchase.supplier')}</th>
                  <th className="px-4 py-3">{t('staff.purchase.purchaseDate')}</th>
                  <th className="px-4 py-3">{t('orders.items')}</th>
                  <th className="px-4 py-3">{t('staff.purchase.transportCost')}</th>
                  <th className="px-4 py-3 text-right">{t('staff.purchase.totalCost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p) => (
                  <tr key={String(p.id)} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-display font-bold">
                      <Link to={`/staff/purchases/${p.id}`} className="text-primary hover:underline">
                        {p.supplierName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{fmtDate(p.purchaseDate)}</td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {p.items.map((item) => `${item.vegetableName} (${formatQty(item.quantity)})`).join(', ') ||
                        `${p.items.length} ${t('orders.items')}`}
                    </td>
                    <td className="money-num px-4 py-3">{formatMoney(p.transportCost)}</td>
                    <td className="px-4 py-3 text-right font-display font-extrabold">
                      <MoneyDisplay value={p.totalCost} className="text-primary" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((p) => (
                <Card key={String(p.id)} asChild>
                  <Link
                    to={`/staff/purchases/${p.id}`}
                    className="hover:border-primary/50 flex flex-col justify-between gap-3 p-4 transition-colors sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-lg font-bold">{p.supplierName}</h2>
                          <Badge variant="outline">{fmtDate(p.purchaseDate)}</Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {p.items.length} {t('orders.items')}
                          {Number(p.transportCost) > 0 &&
                            ` · ${t('staff.purchase.transportCost')}: ${formatMoney(p.transportCost)}`}
                        </p>
                      </div>
                      <MoneyDisplay
                        value={p.totalCost}
                        className="font-display text-primary shrink-0 text-xl font-extrabold"
                      />
                    </div>

                    {p.items.length > 0 && (
                      <div className="bg-surface-subtle/75 flex flex-wrap gap-1.5 rounded-xl px-3 py-2 text-xs">
                        {p.items.slice(0, 3).map((item) => (
                          <Badge key={String(item.vegetableId)} variant="secondary" className="rounded-full">
                            {item.vegetableName} · {formatQty(item.quantity)}
                          </Badge>
                        ))}
                        {p.items.length > 3 && (
                          <Badge variant="outline" className="rounded-full">
                            +{p.items.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </Link>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t('common.back')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={list.length === 0}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
