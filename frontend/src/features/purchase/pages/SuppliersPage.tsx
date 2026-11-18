import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  LayoutGrid,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sprout,
  Table2,
  Truck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { useAuthStore } from '@/features/auth/store'
import { toApiError } from '@/lib/api'
import { fmtDate } from '@/lib/dates'
import { formatMoney, sumMoney } from '@/lib/money'
import { useCreateSupplier, usePurchases, useSuppliers } from '../hooks'
import type { SupplierType } from '../types'

const schema = z.object({
  name: z.string().trim().min(2, 'Required').max(100),
  type: z.enum(['FARMER', 'WHOLESALE_MARKET', 'OTHER']),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[6-9][0-9]{9}$/.test(v), 'auth.invalidPhone'),
})
type FormValues = z.infer<typeof schema>
type TypeFilter = 'ALL' | SupplierType

export default function SuppliersPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const isOwner = Boolean(user?.roles.includes('OWNER'))

  const suppliers = useSuppliers()
  const purchases = usePurchases(0, isOwner)
  const createSupplier = useCreateSupplier()

  const [serverError, setServerError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [view, setView] = useState<'cards' | 'table'>('cards')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: 'FARMER', phone: '' },
  })

  const supplierList = useMemo(() => suppliers.data ?? [], [suppliers.data])

  const purchaseStatsBySupplier = useMemo(() => {
    const map = new Map<string, { count: number; total: string; latestDate: string }>()
    const rows = purchases.data ?? []
    for (const p of rows) {
      const key = String(p.supplierId)
      const prev = map.get(key)
      if (!prev) {
        map.set(key, {
          count: 1,
          total: String(p.totalCost),
          latestDate: p.purchaseDate,
        })
      } else {
        map.set(key, {
          count: prev.count + 1,
          total: sumMoney([prev.total, p.totalCost]).toFixed(2),
          latestDate: p.purchaseDate > prev.latestDate ? p.purchaseDate : prev.latestDate,
        })
      }
    }
    return map
  }, [purchases.data])

  const counts = useMemo(
    () => ({
      total: supplierList.length,
      farmer: supplierList.filter((s) => s.type === 'FARMER').length,
      wholesale: supplierList.filter((s) => s.type === 'WHOLESALE_MARKET').length,
      linkedSpend: sumMoney((purchases.data ?? []).map((p) => p.totalCost)),
    }),
    [supplierList, purchases.data],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return supplierList.filter((s) => {
      if (typeFilter !== 'ALL' && s.type !== typeFilter) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q)
      )
    })
  }, [supplierList, search, typeFilter])

  const onSubmit = (values: FormValues) => {
    setServerError(null)
    createSupplier.mutate(
      {
        name: values.name.trim(),
        type: values.type as SupplierType,
        phone: values.phone?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('staff.purchase.supplierSaved'))
          reset()
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title={t('staff.purchase.suppliersTitle')}
        count={supplierList.length}
        breadcrumbs={[
          { label: t('staff.groups.buy', { defaultValue: 'Buy' }), to: '/staff/purchases' },
          { label: t('staff.purchase.suppliersTitle') },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/staff/purchases">
                <ShoppingBag className="size-4" aria-hidden />
                {t('staff.purchase.purchasesTitle')}
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/staff/purchases/new">
                <Plus className="size-4" aria-hidden />
                {t('staff.purchase.newPurchase')}
              </Link>
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

      {/* Supplier Overview KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t('staff.purchase.totalSuppliers', { defaultValue: 'Total suppliers' })}
          value={counts.total}
          tone="neutral"
          active={typeFilter === 'ALL'}
          onClick={() => setTypeFilter('ALL')}
          icon={<Truck className="size-5" />}
        />
        <Stat
          label={t('staff.purchase.types.FARMER')}
          value={counts.farmer}
          tone="positive"
          active={typeFilter === 'FARMER'}
          onClick={() => setTypeFilter(typeFilter === 'FARMER' ? 'ALL' : 'FARMER')}
          icon={<Sprout className="size-5" />}
        />
        <Stat
          label={t('staff.purchase.types.WHOLESALE_MARKET')}
          value={counts.wholesale}
          tone="warning"
          active={typeFilter === 'WHOLESALE_MARKET'}
          onClick={() =>
            setTypeFilter(typeFilter === 'WHOLESALE_MARKET' ? 'ALL' : 'WHOLESALE_MARKET')
          }
          icon={<Building2 className="size-5" />}
        />
        <Stat
          label={t('staff.purchase.recentSpend', { defaultValue: 'Recent purchases spend' })}
          value={isOwner ? formatMoney(counts.linkedSpend) : (purchases.data ?? []).length}
          tone="neutral"
          icon={<ShoppingBag className="size-5" />}
        />
      </div>

      {/* Add Supplier Card */}
      <Card className="p-4 sm:p-5">
        <h2 className="font-display mb-3 text-sm font-bold tracking-wide uppercase">
          {t('staff.purchase.addSupplier')}
        </h2>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="grid gap-3 sm:grid-cols-[1fr_170px_215px_auto] sm:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="sup-name">{t('staff.purchase.supplierName')}</Label>
            <Input id="sup-name" aria-invalid={!!errors.name} {...register('name')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-type">{t('staff.purchase.supplierType')}</Label>
            <select
              id="sup-type"
              className="border-input bg-card flex h-11 w-full rounded-lg border px-3 text-sm"
              {...register('type')}
            >
              <option value="FARMER">{t('staff.purchase.types.FARMER')}</option>
              <option value="WHOLESALE_MARKET">
                {t('staff.purchase.types.WHOLESALE_MARKET')}
              </option>
              <option value="OTHER">{t('staff.purchase.types.OTHER')}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-phone">
              {t('auth.phone')} ({t('common.optional')})
            </Label>
            <Input
              id="sup-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder={t('auth.phonePlaceholder')}
              aria-invalid={!!errors.phone}
              {...register('phone')}
            />
          </div>

          <Button type="submit" loading={createSupplier.isPending} className="rounded-full">
            <Plus className="size-4" aria-hidden />
            {t('staff.purchase.addSupplier')}
          </Button>
        </form>

        {(errors.name?.message || errors.phone?.message || serverError) && (
          <p role="alert" className="text-destructive mt-2 text-xs font-medium">
            {serverError ??
              t(errors.name?.message ?? errors.phone!.message!, {
                defaultValue: errors.name?.message ?? errors.phone!.message,
              })}
          </p>
        )}
      </Card>

      {/* Search & Filter Row */}
      {supplierList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              type="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
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

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['ALL', t('common.all')],
                ['FARMER', t('staff.purchase.types.FARMER')],
                ['WHOLESALE_MARKET', t('staff.purchase.types.WHOLESALE_MARKET')],
                ['OTHER', t('staff.purchase.types.OTHER')],
              ] as [TypeFilter, string][]
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={typeFilter === key ? 'default' : 'outline'}
                onClick={() => setTypeFilter(key)}
                className="rounded-full"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {suppliers.isPending || suppliers.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : suppliers.isError ? (
        <ErrorState onRetry={() => void suppliers.refetch()} />
      ) : supplierList.length === 0 ? (
        <EmptyState title={t('common.noData')} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('common.noResults')}
          actionLabel={t('common.resetFilters')}
          onAction={() => {
            setSearch('')
            setTypeFilter('ALL')
          }}
        />
      ) : view === 'table' ? (
        <DataTable aria-label={t('staff.purchase.suppliersTitle')}>
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-3">{t('staff.purchase.supplierName')}</th>
              <th className="px-4 py-3">{t('staff.purchase.supplierType')}</th>
              <th className="px-4 py-3">{t('auth.phone')}</th>
              <th className="px-4 py-3">{t('staff.purchase.purchasesTitle')}</th>
              <th className="px-4 py-3 text-right">{t('common.actions', { defaultValue: 'Actions' })}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((s) => {
              const cleanPhone = (s.phone ?? '').replace(/\D/g, '')
              const stats = purchaseStatsBySupplier.get(String(s.id))
              return (
                <tr key={String(s.id)} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-display font-bold">{s.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {t(`staff.purchase.types.${s.type}`, { defaultValue: s.type })}
                    </Badge>
                  </td>
                  <td className="money-num text-muted-foreground px-4 py-3">
                    {s.phone || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {stats ? (
                      <span className="font-semibold">
                        {stats.count} · {formatMoney(stats.total)} ({fmtDate(stats.latestDate)})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {s.phone && (
                        <Button variant="outline" size="sm" asChild className="rounded-full">
                          <a href={`tel:${s.phone}`}>
                            <Phone className="size-3.5" aria-hidden />
                            {t('common.call', { defaultValue: 'Call' })}
                          </a>
                        </Button>
                      )}
                      {cleanPhone.length >= 10 && (
                        <Button variant="outline" size="sm" asChild className="rounded-full">
                          <a
                            href={`https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="size-3.5" aria-hidden />
                            WhatsApp
                          </a>
                        </Button>
                      )}
                      <Button asChild variant="secondary" size="sm" className="rounded-full">
                        <Link to={`/staff/purchases/new?supplierId=${s.id}`}>
                          <Plus className="size-3.5" aria-hidden />
                          {t('staff.purchase.newPurchase')}
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const cleanPhone = (s.phone ?? '').replace(/\D/g, '')
            const stats = purchaseStatsBySupplier.get(String(s.id))
            return (
              <Card key={String(s.id)} className="flex flex-col justify-between gap-3 p-4 sm:p-5">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-display truncate text-lg font-bold">{s.name}</h2>
                      <p className="text-muted-foreground money-num mt-0.5 text-xs">
                        {s.phone || t('common.noPhone', { defaultValue: 'No phone saved' })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {t(`staff.purchase.types.${s.type}`, { defaultValue: s.type })}
                    </Badge>
                  </div>

                  <div className="bg-surface-subtle/75 flex items-center justify-between rounded-xl px-3 py-2 text-xs">
                    <span className="text-muted-foreground font-medium">
                      {t('staff.purchase.purchasesTitle')}
                    </span>
                    <span className="money-num font-bold">
                      {stats
                        ? `${stats.count} · ${formatMoney(stats.total)}`
                        : `0`}
                    </span>
                  </div>
                </div>

                <div className="border-border/70 flex flex-wrap items-center gap-2 border-t pt-3">
                  {s.phone && (
                    <Button variant="outline" size="sm" asChild className="rounded-full">
                      <a href={`tel:${s.phone}`}>
                        <Phone className="size-3.5" aria-hidden />
                        {t('common.call', { defaultValue: 'Call' })}
                      </a>
                    </Button>
                  )}
                  {cleanPhone.length >= 10 && (
                    <Button variant="outline" size="sm" asChild className="rounded-full">
                      <a
                        href={`https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="size-3.5" aria-hidden />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="secondary" className="ml-auto rounded-full">
                    <Link to={`/staff/purchases/new?supplierId=${s.id}`}>
                      <Plus className="size-3.5" aria-hidden />
                      {t('staff.purchase.newPurchase')}
                    </Link>
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
