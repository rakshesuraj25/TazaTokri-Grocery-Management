import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  ChevronRight,
  Edit2,
  MapPin,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sprout,
  Truck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { toApiError } from '@/lib/api'
import { fmtDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import {
  useCreateSupplier,
  useSupplierDashboard,
  useUpdateSupplier,
  useUpdateSupplierStatus,
} from '../hooks'
import type { SupplierSummary, SupplierType } from '../types'

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  type: z.enum(['FARMER', 'WHOLESALE_MARKET', 'OTHER']),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[6-9][0-9]{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number'),
  address: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(500).optional(),
})
type FormValues = z.infer<typeof schema>
type TypeFilter = 'ALL' | SupplierType
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
type SortKey = 'OUTSTANDING_DESC' | 'PURCHASES_DESC' | 'NAME_ASC'

export default function SuppliersPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('OUTSTANDING_DESC')
  const [editing, setEditing] = useState<SupplierSummary | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const dashboard = useSupplierDashboard()
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()
  const updateStatus = useUpdateSupplierStatus()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: 'FARMER', phone: '', address: '', notes: '' },
  })

  function startEdit(s: SupplierSummary) {
    setEditing(s)
    setServerError(null)
    reset({
      name: s.name,
      type: s.type,
      phone: s.phone ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
    })
  }

  function cancelEdit() {
    setEditing(null)
    setServerError(null)
    reset({ name: '', type: 'FARMER', phone: '', address: '', notes: '' })
  }

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const payload = {
      name: values.name.trim(),
      type: values.type,
      phone: values.phone?.trim() || undefined,
      address: values.address?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    }
    try {
      if (editing) {
        await updateSupplier.mutateAsync({ id: editing.id, body: payload })
        toast.success('Supplier updated')
        cancelEdit()
      } else {
        await createSupplier.mutateAsync(payload)
        toast.success(t('staff.purchase.supplierAdded', { defaultValue: 'Supplier added' }))
        reset({ name: '', type: 'FARMER', phone: '', address: '', notes: '' })
      }
    } catch (err) {
      setServerError(toApiError(err).message)
    }
  }

  async function handleToggleStatus(s: SupplierSummary) {
    try {
      await updateStatus.mutateAsync({ id: s.id, active: !s.active })
      toast.success(s.active ? 'Supplier deactivated' : 'Supplier activated')
    } catch (err) {
      toast.error(toApiError(err).message)
    }
  }

  const filtered = useMemo(() => {
    const list = dashboard.data?.suppliers ?? []
    const q = search.trim().toLowerCase()
    return list
      .filter((s) => {
        if (typeFilter !== 'ALL' && s.type !== typeFilter) return false
        if (statusFilter === 'ACTIVE' && !s.active) return false
        if (statusFilter === 'INACTIVE' && s.active) return false
        if (!q) return true
        return (
          s.name.toLowerCase().includes(q) ||
          (s.phone ?? '').toLowerCase().includes(q) ||
          (s.address ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        if (sortBy === 'OUTSTANDING_DESC') {
          return Number(b.outstandingPayable) - Number(a.outstandingPayable)
        }
        if (sortBy === 'PURCHASES_DESC') {
          return Number(b.totalPurchases) - Number(a.totalPurchases)
        }
        return a.name.localeCompare(b.name)
      })
  }, [dashboard.data, search, typeFilter, statusFilter, sortBy])

  const d = dashboard.data

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3.5 py-4 sm:px-6 sm:py-6">
      <PageHeader
        title={t('staff.purchase.suppliersTitle', { defaultValue: 'Suppliers & Payables' })}
        serif
        count={d?.totalSuppliers}
        breadcrumbs={[
          { label: t('staff.groups.buy', { defaultValue: 'Buy' }) },
          { label: t('staff.purchase.suppliersTitle', { defaultValue: 'Suppliers' }) },
        ]}
        actions={
          <Button asChild size="sm" className="rounded-full">
            <Link to="/staff/purchases/new">
              <ShoppingBag className="size-4" aria-hidden />
              {t('staff.purchase.newPurchase', { defaultValue: 'New Purchase' })}
            </Link>
          </Button>
        }
      />

      {d && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Total Suppliers" value={d.totalSuppliers} />
          <Stat label="Active Suppliers" value={d.activeSuppliers} />
          <Stat label="Total Purchases" value={formatMoney(d.totalPurchases)} />
          <Stat label="Total Paid" value={formatMoney(d.totalPayments)} />
          <Stat
            label="Outstanding Payable"
            value={formatMoney(d.totalOutstandingPayable)}
            hint={Number(d.totalOutstandingPayable) > 0 ? 'Pending settlement' : 'All settled'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_2fr]">
        {/* Add / Edit Supplier Card */}
        <Card className="h-fit rounded-3xl border p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">
              {editing ? `Edit: ${editing.name}` : 'Add Supplier'}
            </h2>
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                <X className="size-4" /> Cancel
              </Button>
            )}
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            {serverError && (
              <p className="text-destructive text-sm font-medium" role="alert">
                {serverError}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="sup-name">Supplier Name *</Label>
              <Input id="sup-name" placeholder="e.g. Ganesh Mandi" {...register('name')} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sup-type">Supplier Type *</Label>
              <select
                id="sup-type"
                {...register('type')}
                className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
              >
                <option value="FARMER">Farmer</option>
                <option value="WHOLESALE_MARKET">Wholesale Market</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sup-phone">Mobile Number</Label>
              <Input id="sup-phone" placeholder="10-digit mobile" {...register('phone')} />
              {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sup-address">Address</Label>
              <Input id="sup-address" placeholder="Market / Village / City" {...register('address')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sup-notes">Notes</Label>
              <Input id="sup-notes" placeholder="Optional notes" {...register('notes')} />
            </div>
            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={createSupplier.isPending || updateSupplier.isPending}
            >
              <Plus className="size-4" aria-hidden />
              {editing ? 'Save Changes' : 'Add Supplier'}
            </Button>
          </form>
        </Card>

        {/* Supplier Directory */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or address..."
                className="rounded-full pl-9"
              />
            </div>
            <select
              aria-label="Filter by type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="border-input bg-background h-10 rounded-full border px-3 text-xs font-medium"
            >
              <option value="ALL">All Types</option>
              <option value="FARMER">Farmer</option>
              <option value="WHOLESALE_MARKET">Wholesale</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="border-input bg-background h-10 rounded-full border px-3 text-xs font-medium"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              aria-label="Sort suppliers"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="border-input bg-background h-10 rounded-full border px-3 text-xs font-medium"
            >
              <option value="OUTSTANDING_DESC">Highest Outstanding</option>
              <option value="PURCHASES_DESC">Highest Purchases</option>
              <option value="NAME_ASC">Name (A-Z)</option>
            </select>
          </div>

          {dashboard.isLoading ? (
            <Card className="rounded-3xl p-6 text-center text-sm text-muted-foreground">
              Loading suppliers...
            </Card>
          ) : dashboard.isError ? (
            <ErrorState message={toApiError(dashboard.error).message} onRetry={() => dashboard.refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No suppliers found" description="Try adjusting your search or filters." />
          ) : (
            <div className="space-y-3">
              {filtered.map((s) => (
                <Card key={s.id} className="rounded-3xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/staff/suppliers/${s.id}`}
                          className="text-base font-bold hover:underline"
                        >
                          {s.name}
                        </Link>
                        <Badge variant="outline" className="text-[11px]">
                          {s.type === 'FARMER' && <Sprout className="mr-1 size-3" />}
                          {s.type === 'WHOLESALE_MARKET' && <Building2 className="mr-1 size-3" />}
                          {s.type === 'OTHER' && <Truck className="mr-1 size-3" />}
                          {s.type.replace('_', ' ')}
                        </Badge>
                        <Badge variant={s.active ? 'default' : 'secondary'}>
                          {s.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                        {s.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3" /> {s.phone}
                          </span>
                        )}
                        {s.address && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" /> {s.address}
                          </span>
                        )}
                        {s.lastPurchaseDate && (
                          <span>Last purchase: {fmtDate(s.lastPurchaseDate)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(s)}
                        aria-label={`Edit ${s.name}`}
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs"
                        onClick={() => handleToggleStatus(s)}
                      >
                        {s.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button asChild size="sm" className="rounded-full text-xs">
                        <Link to={`/staff/suppliers/${s.id}`}>
                          Details <ChevronRight className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Purchases ({s.purchaseCount})</span>
                      <span className="font-semibold">{formatMoney(s.totalPurchases)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Paid</span>
                      <span className="font-semibold text-emerald-700">{formatMoney(s.totalPayments)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Outstanding</span>
                      <span
                        className={`font-bold ${
                          Number(s.outstandingPayable) > 0 ? 'text-amber-700' : 'text-muted-foreground'
                        }`}
                      >
                        {formatMoney(s.outstandingPayable)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
