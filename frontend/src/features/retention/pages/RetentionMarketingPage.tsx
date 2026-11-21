import { useMemo, useState } from 'react'
import {
  Award,
  Megaphone,
  Plus,
  Repeat,
  Search,
  Tag,
  UserCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { toApiError } from '@/lib/api'
import { addDaysIST, fmtDate, todayIST } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import {
  useCreatePromo,
  useOwnerPromos,
  useRetentionInsights,
  useTogglePromo,
  useUpdatePromo,
  type CustomerSegment,
  type PromoDiscountType,
  type PromoOffer,
} from '../api'

type DatePreset = 'TODAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'CUSTOM'

export default function RetentionMarketingPage() {
  const today = useMemo(() => todayIST(), [])
  const [preset, setPreset] = useState<DatePreset>('LAST_30')
  const [fromDate, setFromDate] = useState(() => addDaysIST(today, -29))
  const [toDate, setToDate] = useState(() => today)
  const [segment, setSegment] = useState<CustomerSegment | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'spend' | 'orders' | 'recent'>('spend')
  const [page, setPage] = useState(0)

  const insightsQuery = useRetentionInsights({
    from: fromDate,
    to: toDate,
    segment: segment === 'ALL' ? undefined : segment,
    search,
    sortBy,
    page,
    size: 15,
  })
  const promosQuery = useOwnerPromos()
  const createPromo = useCreatePromo()
  const updatePromo = useUpdatePromo()
  const togglePromo = useTogglePromo()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PromoOffer | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<PromoDiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('10')
  const [minOrderAmount, setMinOrderAmount] = useState('150')
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('50')
  const [startsAt, setStartsAt] = useState(`${today}T00:00`)
  const [expiresAt, setExpiresAt] = useState(`${addDaysIST(today, 14)}T23:59`)
  const [maxTotalUses, setMaxTotalUses] = useState('')
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState('1')
  const [enabled, setEnabled] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)

  const handlePreset = (next: DatePreset) => {
    setPreset(next)
    setPage(0)
    if (next === 'TODAY') {
      setFromDate(today)
      setToDate(today)
    } else if (next === 'LAST_7') {
      setFromDate(addDaysIST(today, -6))
      setToDate(today)
    } else if (next === 'LAST_30') {
      setFromDate(addDaysIST(today, -29))
      setToDate(today)
    } else if (next === 'THIS_MONTH') {
      setFromDate(`${today.slice(0, 7)}-01`)
      setToDate(today)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setName('')
    setCode('')
    setDescription('')
    setDiscountType('PERCENTAGE')
    setDiscountValue('10')
    setMinOrderAmount('150')
    setMaxDiscountAmount('50')
    setStartsAt(`${today}T00:00`)
    setExpiresAt(`${addDaysIST(today, 14)}T23:59`)
    setMaxTotalUses('')
    setMaxUsesPerCustomer('1')
    setEnabled(true)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (offer: PromoOffer) => {
    setEditing(offer)
    setName(offer.name)
    setCode(offer.code)
    setDescription(offer.description ?? '')
    setDiscountType(offer.discountType)
    setDiscountValue(String(offer.discountValue))
    setMinOrderAmount(String(offer.minOrderAmount))
    setMaxDiscountAmount(offer.maxDiscountAmount !== null ? String(offer.maxDiscountAmount) : '')
    setStartsAt(offer.startsAt.slice(0, 16))
    setExpiresAt(offer.expiresAt.slice(0, 16))
    setMaxTotalUses(offer.maxTotalUses !== null ? String(offer.maxTotalUses) : '')
    setMaxUsesPerCustomer(String(offer.maxUsesPerCustomer))
    setEnabled(offer.enabled)
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSaveOffer = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const val = Number(discountValue)
    const minOrd = Number(minOrderAmount || 0)
    const maxDisc =
      discountType === 'PERCENTAGE' && maxDiscountAmount.trim() !== ''
        ? Number(maxDiscountAmount)
        : null
    const totalUses = maxTotalUses.trim() === '' ? null : Number(maxTotalUses)
    const perCust = Number(maxUsesPerCustomer || 1)

    if (!name.trim() || !code.trim()) {
      setFormError('Offer name and promo code are required.')
      return
    }
    if (!Number.isFinite(val) || val <= 0) {
      setFormError('Discount value must be greater than 0.')
      return
    }
    if (discountType === 'PERCENTAGE' && val > 100) {
      setFormError('Percentage discount cannot exceed 100%.')
      return
    }

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      discountType,
      discountValue: val,
      minOrderAmount: minOrd,
      maxDiscountAmount: maxDisc,
      startsAt: startsAt.length === 16 ? `${startsAt}:00` : startsAt,
      expiresAt: expiresAt.length === 16 ? `${expiresAt}:00` : expiresAt,
      maxTotalUses: totalUses,
      maxUsesPerCustomer: perCust,
      enabled,
    }

    const mutation = editing
      ? updatePromo.mutateAsync({ id: editing.id, body: payload })
      : createPromo.mutateAsync(payload)

    mutation
      .then(() => {
        toast.success(editing ? 'Promo offer updated' : 'Promo offer created')
        setDialogOpen(false)
      })
      .catch((err) => setFormError(toApiError(err).message))
  }

  const dash = insightsQuery.data
  const promos = promosQuery.data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title="Customer Retention & Marketing"
        breadcrumbs={[{ label: 'Team' }, { label: 'Retention & Promos' }]}
        actions={
          <Button type="button" size="sm" className="rounded-full" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New Promo Offer
          </Button>
        }
      />

      {/* Date Filters */}
      <Card className="p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['TODAY', 'Today'],
              ['LAST_7', 'Last 7 days'],
              ['LAST_30', 'Last 30 days'],
              ['THIS_MONTH', 'This month'],
              ['CUSTOM', 'Custom'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={preset === key ? 'default' : 'outline'}
              className="rounded-full text-xs"
              onClick={() => handlePreset(key)}
            >
              {label}
            </Button>
          ))}
          {preset === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                aria-label="From date"
                value={fromDate}
                max={toDate}
                onChange={(e) => e.target.value && setFromDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                aria-label="To date"
                value={toDate}
                min={fromDate}
                max={today}
                onChange={(e) => e.target.value && setToDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
          )}
        </div>
      </Card>

      {insightsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : insightsQuery.isError || !dash ? (
        <ErrorState onRetry={() => void insightsQuery.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Total Customers"
              value={String(dash.totalCustomers)}
              hint={`New in period: ${dash.newCustomersInPeriod}`}
              icon={<Users className="size-5" />}
            />
            <Stat
              label="Repeat Customers"
              value={`${dash.repeatCustomers} (${dash.repeatPurchaseRate}%)`}
              hint={`Avg orders: ${dash.averageOrderFrequency}`}
              icon={<Repeat className="size-5" />}
              tone="positive"
            />
            <Stat
              label="High-Value"
              value={String(dash.highValueCustomers)}
              hint={`Avg spend: ${formatMoney(dash.averageLifetimeSpend)}`}
              icon={<Award className="size-5" />}
            />
            <Stat
              label="Inactive Customers"
              value={String(dash.inactiveCustomers)}
              hint={`>= ${dash.inactiveDaysThreshold} days since order`}
              icon={<UserCheck className="size-5" />}
              tone={dash.inactiveCustomers > 0 ? 'warning' : 'neutral'}
            />
          </div>

          {/* Customer Segmentation & Targeting */}
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Customer Segmentation & Insights</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Sort customers"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'spend' | 'orders' | 'recent')}
                    className="border-input bg-card h-8 rounded-lg border px-2 text-xs"
                  >
                    <option value="spend">Sort: Highest Spend</option>
                    <option value="orders">Sort: Most Orders</option>
                    <option value="recent">Sort: Most Recent</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    aria-label="Search customers"
                    placeholder="Search name or mobile"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(0)
                    }}
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['ALL', 'HIGH_VALUE', 'REPEAT', 'NEW', 'INACTIVE', 'ACTIVE'] as const).map(
                    (seg) => (
                      <Button
                        key={seg}
                        type="button"
                        size="sm"
                        variant={segment === seg ? 'default' : 'outline'}
                        className="rounded-full text-xs"
                        onClick={() => {
                          setSegment(seg)
                          setPage(0)
                        }}
                      >
                        {seg.replaceAll('_', ' ')}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dash.customers.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-7" aria-hidden />}
                  title="No matching customers"
                  description="Try clearing the segment or search filter."
                />
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-muted/50 text-xs uppercase">
                        <tr>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2">Segment</th>
                          <th className="px-3 py-2 text-right">Orders</th>
                          <th className="px-3 py-2 text-right">Total Spend</th>
                          <th className="px-3 py-2 text-right">AOV</th>
                          <th className="px-3 py-2 text-right">Loyalty</th>
                          <th className="px-3 py-2">Last Order</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {dash.customers.map((c) => (
                          <tr key={c.customerId} className="hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <p className="font-semibold">{c.fullName}</p>
                              <p className="text-muted-foreground text-xs">{c.phone}</p>
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  c.segment === 'HIGH_VALUE' || c.segment === 'REPEAT'
                                    ? 'success'
                                    : c.segment === 'INACTIVE'
                                      ? 'warning'
                                      : 'secondary'
                                }
                              >
                                {c.segment.replaceAll('_', ' ')}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right">{c.totalOrders}</td>
                            <td className="px-3 py-2 text-right">
                              <MoneyDisplay value={c.totalSpend} className="font-semibold" />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <MoneyDisplay value={c.averageOrderValue} />
                            </td>
                            <td className="px-3 py-2 text-right text-xs">{c.loyaltyBalance} pts</td>
                            <td className="text-muted-foreground px-3 py-2 text-xs">
                              {c.lastOrderDate
                                ? `${fmtDate(c.lastOrderDate)} (${c.daysSinceLastOrder}d ago)`
                                : 'Never'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Showing {dash.customers.length} of {dash.totalMatchingCustomers} customers
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={(page + 1) * dash.size >= dash.totalMatchingCustomers}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Promotional Offers Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="text-primary size-4" aria-hidden />
            Promotional Offers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {promos.length === 0 ? (
            <EmptyState
              icon={<Tag className="size-7" aria-hidden />}
              title="No promotional offers yet"
              description="Create a percentage or fixed discount promo code for your customers."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {promos.map((offer) => (
                <Card key={offer.id} className="flex flex-col justify-between space-y-3 p-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="font-mono font-bold">
                        {offer.code}
                      </Badge>
                      <Switch
                        checked={offer.enabled}
                        aria-label={`Toggle ${offer.code}`}
                        onCheckedChange={(val) =>
                          togglePromo.mutate({ id: offer.id, enabled: val })
                        }
                      />
                    </div>
                    <p className="font-display font-bold">{offer.name}</p>
                    <p className="text-primary text-xs font-semibold">
                      {offer.discountType === 'PERCENTAGE'
                        ? `${offer.discountValue}% off`
                        : `${formatMoney(offer.discountValue)} off`}
                      {offer.maxDiscountAmount ? ` (max ${formatMoney(offer.maxDiscountAmount)})` : ''}
                      {offer.minOrderAmount > 0 ? ` · Min ${formatMoney(offer.minOrderAmount)}` : ''}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Used: {offer.totalUsed}
                      {offer.maxTotalUses ? ` / ${offer.maxTotalUses}` : ''} · Per customer:{' '}
                      {offer.maxUsesPerCustomer}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {fmtDate(offer.startsAt)} – {fmtDate(offer.expiresAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => openEdit(offer)}
                  >
                    Edit Offer
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Offer: ${editing.code}` : 'Create Promo Offer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveOffer} noValidate className="space-y-3">
            {formError && (
              <div role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="promo-name">Offer name</Label>
                <Input id="promo-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="promo-code">Promo code</Label>
                <Input
                  id="promo-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="promo-desc">Description (optional)</Label>
              <Input
                id="promo-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="promo-type">Type</Label>
                <select
                  id="promo-type"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
                  className="border-input bg-card h-10 w-full rounded-lg border px-2 text-sm"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed (₹)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="promo-val">Discount value</Label>
                <Input
                  id="promo-val"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="promo-min">Min order (₹)</Label>
                <Input
                  id="promo-min"
                  type="number"
                  min="0"
                  step="1"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {discountType === 'PERCENTAGE' && (
                <div className="space-y-1">
                  <Label htmlFor="promo-max-disc">Max discount (₹)</Label>
                  <Input
                    id="promo-max-disc"
                    type="number"
                    min="1"
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="promo-max-uses">Max total uses</Label>
                <Input
                  id="promo-max-uses"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={maxTotalUses}
                  onChange={(e) => setMaxTotalUses(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="promo-per-cust">Per customer</Label>
                <Input
                  id="promo-per-cust"
                  type="number"
                  min="1"
                  value={maxUsesPerCustomer}
                  onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="promo-start">Starts at</Label>
                <Input
                  id="promo-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="promo-end">Expires at</Label>
                <Input
                  id="promo-end"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPromo.isPending || updatePromo.isPending}>
                Save Offer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
