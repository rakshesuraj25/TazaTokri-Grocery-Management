import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calculator,
  ClipboardList,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { StatGridSkeleton } from '@/components/Skeletons'
import { toApiError } from '@/lib/api'
import { fmtDate } from '@/lib/dates'
import { formatMoney, formatQty } from '@/lib/money'
import { useBusinessOverview, type InventoryAlertItem } from '../overviewApi'

function alertBadgeVariant(
  alertType: InventoryAlertItem['alertType'],
): 'destructive' | 'default' | 'secondary' {
  if (alertType === 'OUT_OF_STOCK' || alertType === 'CRITICAL_RISK') return 'destructive'
  if (alertType === 'HIGH_RISK') return 'default'
  return 'secondary'
}

function alertLabel(alertType: InventoryAlertItem['alertType']): string {
  switch (alertType) {
    case 'OUT_OF_STOCK':
      return 'Out of Stock'
    case 'CRITICAL_RISK':
      return 'Critical Risk'
    case 'HIGH_RISK':
      return 'High Risk'
    case 'LOW_STOCK':
      return 'Low Stock'
  }
}

export default function DashboardPage() {
  const overview = useBusinessOverview()
  const data = overview.data

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title="Business Overview"
        breadcrumbs={[{ label: 'Owner' }, { label: 'Business Overview' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data?.kpis.date && (
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                Today: {fmtDate(data.kpis.date)}
              </Badge>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => void overview.refetch()}
              disabled={overview.isFetching}
            >
              <RefreshCw className={`size-4 ${overview.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {overview.isLoading ? (
        <div className="space-y-4">
          <StatGridSkeleton count={6} />
          <Card className="rounded-3xl p-6 text-center text-sm text-muted-foreground">
            Loading business overview...
          </Card>
        </div>
      ) : overview.isError || !data ? (
        <ErrorState
          message={overview.error ? toApiError(overview.error).message : 'Failed to load overview'}
          onRetry={() => void overview.refetch()}
        />
      ) : (
        <>
          {/* 1. Primary KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="rounded-3xl border p-4">
              <p className="text-muted-foreground text-xs font-medium">Today&apos;s Sales</p>
              <p className="font-display mt-1 text-xl font-extrabold">
                {formatMoney(data.kpis.todaySales)}
              </p>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {data.kpis.salesChangePercent !== null ? (
                  Number(data.kpis.salesChangeAmount) >= 0 ? (
                    <span className="inline-flex items-center font-semibold text-emerald-700">
                      <ArrowUpRight className="size-3.5" />+{data.kpis.salesChangePercent}% vs
                      yesterday
                    </span>
                  ) : (
                    <span className="inline-flex items-center font-semibold text-rose-700">
                      <ArrowDownRight className="size-3.5" />
                      {data.kpis.salesChangePercent}% vs yesterday
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground">
                    Yesterday: {formatMoney(data.kpis.yesterdaySales)}
                  </span>
                )}
              </div>
            </Card>
            <Stat label="Today's Orders" value={data.kpis.todayOrders} />
            <Stat
              label="Pending Orders"
              value={data.kpis.pendingOrders}
              tone={data.kpis.pendingOrders > 0 ? 'warning' : undefined}
            />
            <Stat label="Completed Orders" value={data.kpis.completedOrders} tone="positive" />
            <Stat
              label="Cancelled Orders"
              value={data.kpis.cancelledOrders}
              tone={data.kpis.cancelledOrders > 0 ? 'danger' : undefined}
            />
            <Stat label="Average Order Value" value={formatMoney(data.kpis.averageOrderValue)} />
          </div>

          {/* 2. Quick Actions */}
          <Card className="rounded-3xl border p-4">
            <h2 className="mb-3 text-sm font-bold">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link to="/staff/catalog/new">
                  <Plus className="size-4" /> Add Vegetable
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/staff/purchases/new">
                  <ShoppingBag className="size-4" /> Create Purchase
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/staff/orders">
                  <ClipboardList className="size-4" /> View Orders
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/staff/stock">
                  <Warehouse className="size-4" /> Manage Inventory
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/staff/cash-closing">
                  <Calculator className="size-4" /> Cash Closing
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/staff/suppliers">
                  <Truck className="size-4" /> Suppliers
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/staff/users">
                  <Users className="size-4" /> Customer Management
                </Link>
              </Button>
            </div>
          </Card>

          {/* 3. Order Status Overview & Financial Overview */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-3xl border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="size-4" /> Order Overview (Today)
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link to="/staff/orders">Manage Orders</Link>
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[
                  { label: 'Pending Confirmation', count: data.orderStatus.pendingConfirmation },
                  { label: 'Confirmed', count: data.orderStatus.confirmed },
                  { label: 'Preparing', count: data.orderStatus.preparing },
                  { label: 'Out for Delivery', count: data.orderStatus.outForDelivery },
                  { label: 'Delivered', count: data.orderStatus.delivered },
                  { label: 'Cancelled', count: data.orderStatus.cancelled },
                ].map((s) => (
                  <Link
                    key={s.label}
                    to="/staff/orders"
                    className="hover:bg-muted/60 rounded-2xl border p-3 transition-colors"
                  >
                    <span className="text-muted-foreground block text-xs">{s.label}</span>
                    <span className="font-display text-lg font-bold">{s.count}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Banknote className="size-4" /> Financial Overview
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link to="/staff/cash-closing">Cash Closing</Link>
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div className="rounded-2xl border p-3">
                  <span className="text-muted-foreground block text-xs">Today&apos;s Cash Sales</span>
                  <span className="font-display text-base font-bold">
                    {formatMoney(data.financials.todayCashSales)}
                  </span>
                </div>
                <div className="rounded-2xl border p-3">
                  <span className="text-muted-foreground block text-xs">Digital Sales</span>
                  <span className="font-display text-base font-bold">
                    {formatMoney(data.financials.todayDigitalSales)}
                  </span>
                </div>
                <div className="rounded-2xl border p-3">
                  <span className="text-muted-foreground block text-xs">COD Collected</span>
                  <span className="font-display text-base font-bold">
                    {formatMoney(data.financials.codCollected)}
                  </span>
                </div>
                <div className="rounded-2xl border p-3">
                  <span className="text-muted-foreground block text-xs">COD Settled to Shop</span>
                  <span className="font-display text-base font-bold text-emerald-700">
                    {formatMoney(data.financials.codSettledToShop)}
                  </span>
                </div>
                <div className="rounded-2xl border p-3">
                  <span className="text-muted-foreground block text-xs">Pending COD</span>
                  <span className="font-display text-base font-bold text-amber-700">
                    {formatMoney(data.financials.codPendingSettlement)}
                  </span>
                </div>
                <Link
                  to="/staff/suppliers"
                  className="hover:bg-muted/60 rounded-2xl border p-3 transition-colors"
                >
                  <span className="text-muted-foreground block text-xs">Supplier Payable</span>
                  <span className="font-display text-base font-bold text-rose-700">
                    {formatMoney(data.financials.supplierOutstandingPayable)}
                  </span>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* 4. Inventory Alerts & Top-Selling Products */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-3xl border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-amber-600" /> Inventory Alerts
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link to="/staff/inventory-insights">Demand Insights</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.inventoryAlerts.length === 0 ? (
                  <EmptyState
                    title="No inventory alerts"
                    description="All active products have healthy stock levels."
                  />
                ) : (
                  <div className="space-y-2">
                    {data.inventoryAlerts.map((alert) => (
                      <div
                        key={alert.vegetableId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{alert.name}</span>
                            <Badge variant={alertBadgeVariant(alert.alertType)}>
                              {alertLabel(alert.alertType)}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-0.5">
                            Stock: {formatQty(alert.currentStock)} {alert.unit}
                            {alert.daysRemaining !== null
                              ? ` · Est. ${alert.daysRemaining}d left`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button asChild size="sm" variant="outline" className="h-7 rounded-full text-xs">
                            <Link to="/staff/purchases/new">Purchase</Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="h-7 rounded-full text-xs">
                            <Link to="/staff/stock">Stock</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4 text-emerald-700" /> Top-Selling Products Today
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link to="/staff/reports">Full Reports</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.topSellingToday.length === 0 ? (
                  <EmptyState
                    title="No sales recorded today"
                    description="Top-selling vegetables for today will appear here."
                  />
                ) : (
                  <div className="space-y-2">
                    {data.topSellingToday.map((item, idx) => (
                      <div
                        key={item.vegetableId}
                        className="flex items-center justify-between rounded-2xl border p-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="bg-muted flex size-6 items-center justify-center rounded-full font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold">{item.name}</span>
                            <p className="text-muted-foreground">
                              {formatQty(item.quantitySold)} {item.unit} sold
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold">{formatMoney(item.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 5. Recent Activity */}
          <Card className="rounded-3xl border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentActivity.length === 0 ? (
                <EmptyState
                  title="No recent activity"
                  description="Recent orders, purchases, stock movements, and supplier payments appear here."
                />
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {data.recentActivity.map((act, i) => (
                    <Link
                      key={`${act.type}-${i}`}
                      to={act.link}
                      className="hover:bg-muted/60 flex items-center justify-between rounded-2xl border p-3 text-xs transition-colors"
                    >
                      <div>
                        <span className="font-bold">{act.title}</span>
                        <p className="text-muted-foreground">{act.subtitle}</p>
                      </div>
                      {act.amount !== null && (
                        <span className="font-semibold">{formatMoney(act.amount)}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
