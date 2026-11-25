import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  History,
  Phone,
  Search,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { useAuthStore } from '@/features/auth/store'
import { fmtDate, fmtTime } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import {
  useRiderHistory,
  useRiderSummary,
  type RiderSummary,
} from '../riderOpsApi'

export default function RiderOperationsPage() {
  const user = useAuthStore((s) => s.user)
  const isOwner = Boolean(user?.roles.includes('OWNER'))

  const summaryQuery = useRiderSummary()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING_COD'>('ALL')
  const [historyTarget, setHistoryTarget] = useState<RiderSummary | null>(null)

  const historyQuery = useRiderHistory(historyTarget ? historyTarget.userId : null)

  const list = useMemo(() => summaryQuery.data ?? [], [summaryQuery.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((r) => {
      if (statusFilter === 'ACTIVE' && !r.active) return false
      if (statusFilter === 'PENDING_COD' && r.codPendingSettlement <= 0) return false
      if (!q) return true
      return r.fullName.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q)
    })
  }, [list, search, statusFilter])

  const metrics = useMemo(() => {
    const activeRiders = list.filter((r) => r.active).length
    const activeDeliveries = list.reduce(
      (sum, r) => sum + r.assignedCount + r.outForDeliveryCount,
      0,
    )
    const completedDeliveries = list.reduce((sum, r) => sum + r.deliveredCount, 0)
    const pendingCod = list.reduce((sum, r) => sum + r.codPendingSettlement, 0)
    return { activeRiders, activeDeliveries, completedDeliveries, pendingCod }
  }, [list])

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3.5 py-4 sm:px-6 sm:py-6">
      <PageHeader
        serif
        title="Riders & Delivery Operations"
        count={list.length}
        breadcrumbs={[{ label: 'Orders' }, { label: 'Riders & COD' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/staff/orders">
                <Truck className="size-4" aria-hidden />
                Order Dispatch
              </Link>
            </Button>
            {isOwner && (
              <Button asChild size="sm" className="rounded-full">
                <Link to="/staff/payments">
                  <Wallet className="size-4" aria-hidden />
                  Settle COD
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Active Riders"
          value={String(metrics.activeRiders)}
          hint={`${list.length} total`}
          icon={<Users className="size-5" />}
        />
        <Stat
          label="Active Deliveries"
          value={String(metrics.activeDeliveries)}
          icon={<Truck className="size-5" />}
        />
        <Stat
          label="Delivered"
          value={String(metrics.completedDeliveries)}
          icon={<CheckCircle2 className="size-5" />}
          tone="positive"
        />
        <Stat
          label="Pending COD Cash"
          value={formatMoney(metrics.pendingCod)}
          icon={<Wallet className="size-5" />}
          tone={metrics.pendingCod > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            aria-label="Search riders"
            placeholder="Search rider name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['ALL', 'All Riders'],
              ['ACTIVE', 'Active'],
              ['PENDING_COD', 'Pending COD'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={statusFilter === key ? 'default' : 'outline'}
              className="rounded-full text-xs"
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <ErrorState onRetry={() => void summaryQuery.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="size-7" aria-hidden />}
          title="No delivery riders found"
          description="Delivery staff accounts with the DELIVERY role appear here."
        />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rider) => (
            <Card key={rider.userId} className="flex flex-col justify-between space-y-3 p-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display truncate text-base font-bold">{rider.fullName}</h2>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Phone className="size-3.5" aria-hidden />
                      {rider.phone}
                    </p>
                  </div>
                  <Badge variant={rider.active ? 'success' : 'secondary'}>
                    {rider.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl border p-2.5 text-center text-xs">
                  <div>
                    <p className="text-muted-foreground">Active</p>
                    <p className="font-display text-sm font-bold">
                      {rider.assignedCount + rider.outForDeliveryCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Delivered</p>
                    <p className="font-display text-sm font-bold text-primary">
                      {rider.deliveredCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Success</p>
                    <p className="font-display text-sm font-bold">{rider.completionRate}%</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">COD Collected</span>
                    <MoneyDisplay value={rider.codCollectedTotal} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Settled to Shop</span>
                    <MoneyDisplay value={rider.codSettledTotal} />
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Pending Settlement</span>
                    <MoneyDisplay
                      value={rider.codPendingSettlement}
                      className={rider.codPendingSettlement > 0 ? 'text-turmeric-foreground' : ''}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => setHistoryTarget(rider)}
                >
                  <History className="size-3.5" aria-hidden />
                  History
                </Button>
                {isOwner && rider.codPendingSettlement > 0 && (
                  <Button asChild size="sm" className="flex-1 rounded-full">
                    <Link to="/staff/payments">Settle COD</Link>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(historyTarget)} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{historyTarget?.fullName} — Delivery History</DialogTitle>
          </DialogHeader>
          {historyQuery.isLoading ? (
            <div className="skeleton h-32 rounded-xl" />
          ) : historyQuery.isError ? (
            <ErrorState onRetry={() => void historyQuery.refetch()} />
          ) : (historyQuery.data ?? []).length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No delivery attempts recorded yet.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto text-sm">
              {(historyQuery.data ?? []).map((att) => (
                <li key={att.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold">Order #{att.orderId}</p>
                    <p className="text-muted-foreground text-xs">
                      {fmtDate(att.assignedAt)} · {fmtTime(att.assignedAt)}
                      {att.failureReason ? ` · ${att.failureReason}` : ''}
                    </p>
                  </div>
                  <Badge
                    variant={
                      att.status === 'DELIVERED'
                        ? 'success'
                        : att.status === 'FAILED'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {att.status.replaceAll('_', ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
