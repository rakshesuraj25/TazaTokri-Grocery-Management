import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Download,
  Package,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { addDaysIST, fmtDate, todayIST } from '@/lib/dates'
import { formatMoney, formatQty } from '@/lib/money'
import { useBusinessAnalytics, type BusinessAnalyticsReport } from '../analyticsApi'

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'CUSTOM'

function csvEscape(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

function exportAnalyticsCsv(report: BusinessAnalyticsReport) {
  const rows: string[] = [
    ['Section', 'Label', 'Orders/Qty', 'Amount (INR)'].map(csvEscape).join(','),
    ['Summary', `Period ${report.from} to ${report.to}`, report.totalOrders, report.totalSales]
      .map(csvEscape)
      .join(','),
    ...report.dailyTrend.map((d) =>
      ['Daily Trend', d.date, d.orderCount, d.totalSales].map(csvEscape).join(','),
    ),
    ...report.paymentBreakdown.map((p) =>
      ['Payment Channel', p.label, p.count, p.amount].map(csvEscape).join(','),
    ),
    ...report.topProducts.map((p) =>
      ['Top Product', p.name, p.quantity, p.revenue].map(csvEscape).join(','),
    ),
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tazatokri-analytics-${report.from}-to-${report.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function BusinessReportsPage() {
  const today = useMemo(() => todayIST(), [])
  const [preset, setPreset] = useState<DatePreset>('LAST_7')
  const [fromDate, setFromDate] = useState(() => addDaysIST(today, -6))
  const [toDate, setToDate] = useState(() => today)

  const query = useBusinessAnalytics(fromDate, toDate)
  const report = query.data

  const handlePreset = (next: DatePreset) => {
    setPreset(next)
    if (next === 'TODAY') {
      setFromDate(today)
      setToDate(today)
    } else if (next === 'YESTERDAY') {
      const y = addDaysIST(today, -1)
      setFromDate(y)
      setToDate(y)
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

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title="Business Reports & Analytics"
        breadcrumbs={[{ label: 'Money' }, { label: 'Business Reports' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </Button>
            {report && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => exportAnalyticsCsv(report)}
              >
                <Download className="size-4" aria-hidden />
                Export CSV
              </Button>
            )}
          </div>
        }
      />

      {/* Date Filter Bar */}
      <Card className="p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['TODAY', 'Today'],
              ['YESTERDAY', 'Yesterday'],
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
            <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
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

      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : query.isError || !report ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          {report.totalOrders === 0 && report.purchaseSpend === 0 && (
            <EmptyState
              icon={<BarChart3 className="size-7" aria-hidden />}
              title={`No sales or orders between ${fmtDate(report.from)} and ${fmtDate(report.to)}`}
              description="Try expanding the date range to Last 7 days or Last 30 days."
            />
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat
              label="Total Sales"
              value={formatMoney(report.totalSales)}
              hint={`Avg/day ${formatMoney(report.averageDailySales)}`}
              icon={<TrendingUp className="size-5" />}
              tone="positive"
            />
            <Stat
              label="Total Orders"
              value={String(report.totalOrders)}
              hint={`POS ${report.posBills} · Online ${report.onlineValidOrders}`}
              icon={<ShoppingBag className="size-5" />}
            />
            <Stat
              label="Average Order Value"
              value={formatMoney(report.averageOrderValue)}
              hint={`${formatQty(report.totalItemsSold)} items sold`}
              icon={<BarChart3 className="size-5" />}
            />
            <Stat
              label="Cash Collections"
              value={formatMoney(report.cashCollections)}
              hint={`Settled COD: ${formatMoney(report.codSettledToShop)}`}
              icon={<Wallet className="size-5" />}
            />
            <Stat
              label="UPI / Digital Collections"
              value={formatMoney(report.upiDigitalCollections)}
              hint={`Refunds: ${formatMoney(report.totalRefunds)}`}
              icon={<Smartphone className="size-5" />}
            />
            <Stat
              label="COD Collected / Cancelled"
              value={formatMoney(report.codCollected)}
              hint={`Pending: ${formatMoney(report.codPendingSettlement)} · Cancelled: ${report.cancelledOrders}`}
              icon={<Truck className="size-5" />}
              tone={report.cancelledOrders > 0 ? 'warning' : 'neutral'}
            />
          </div>

          {/* Sales Trend & Payment Distribution Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Daily Sales & Order Trend</CardTitle>
                {report.highestSalesDay && (
                  <Badge variant="success">
                    Peak: {fmtDate(report.highestSalesDay.date)} ({formatMoney(report.highestSalesDay.totalSales)})
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="date" tickFormatter={(d) => String(d).slice(5)} fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(val: unknown) => formatMoney(Number(val ?? 0))}
                      labelFormatter={(lbl) => fmtDate(String(lbl))}
                    />
                    <Bar dataKey="posSales" name="Shop POS" stackId="a" fill="#2F6B45" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="onlineSales" name="Online" stackId="a" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Collection Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.paymentBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis type="number" fontSize={11} />
                      <YAxis type="category" dataKey="label" width={120} fontSize={11} />
                      <Tooltip formatter={(val: unknown) => formatMoney(Number(val ?? 0))} />
                      <Bar dataKey="amount" name="Collected" fill="#2F6B45" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="divide-y rounded-xl border text-xs">
                  {report.paymentBreakdown.map((p) => (
                    <div key={p.channel} className="flex items-center justify-between px-3 py-2">
                      <span>
                        {p.label} <span className="text-muted-foreground">({p.count})</span>
                      </span>
                      <MoneyDisplay value={p.amount} className="font-semibold" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Analytics + Inventory & Purchase Spend */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Online Order Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <p className="text-muted-foreground text-xs">Delivered</p>
                  <p className="font-display text-xl font-bold text-primary">{report.deliveredOrders}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-muted-foreground text-xs">Pending</p>
                  <p className="font-display text-xl font-bold">{report.pendingOrders}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-muted-foreground text-xs">Cancelled</p>
                  <p className="font-display text-xl font-bold text-destructive">{report.cancelledOrders}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-muted-foreground text-xs">Refunds</p>
                  <p className="font-display text-xl font-bold">{formatMoney(report.totalRefunds)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="text-primary size-4" aria-hidden />
                  Inventory & Purchase Spend
                </CardTitle>
                <Button asChild size="sm" variant="outline" className="h-7 rounded-full text-xs">
                  <Link to="/staff/stock">View Stock</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border p-3">
                    <p className="text-muted-foreground text-xs">Purchase Spend</p>
                    <p className="font-display text-lg font-bold">{formatMoney(report.purchaseSpend)}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-muted-foreground text-xs">Low Stock</p>
                    <p className="font-display text-lg font-bold text-turmeric-foreground">
                      {report.lowStockCount}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-muted-foreground text-xs">Out of Stock</p>
                    <p className="font-display text-lg font-bold text-destructive">
                      {report.outOfStockCount}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Stock purchase spend is shown separately from sales revenue ({report.totalActiveProducts}{' '}
                  active products tracked).
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Loyalty & Rewards Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loyalty & Rewards Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-xl border p-3">
                <p className="text-muted-foreground text-xs">Points Issued</p>
                <p className="font-display text-xl font-bold text-primary">
                  {report.loyaltyPointsIssued ?? 0}
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-muted-foreground text-xs">Points Redeemed</p>
                <p className="font-display text-xl font-bold">
                  {report.loyaltyPointsRedeemed ?? 0}
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-muted-foreground text-xs">Outstanding Liability</p>
                <p className="font-display text-xl font-bold">
                  {report.loyaltyOutstandingLiability ?? 0} pts
                </p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-muted-foreground text-xs">Redemption Orders</p>
                <p className="font-display text-xl font-bold">
                  {report.loyaltyRedemptionOrders ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Product Analytics */}
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Top-Selling Products</CardTitle>
                {report.bestSellingProduct && (
                  <Badge variant="success">Best: {report.bestSellingProduct.name}</Badge>
                )}
              </CardHeader>
              <CardContent>
                {report.topProducts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No product sales in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="bg-muted/50 text-xs uppercase">
                        <tr>
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2 text-right">Qty Sold</th>
                          <th className="px-3 py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {report.topProducts.slice(0, 15).map((p) => (
                          <tr key={p.vegetableId}>
                            <td className="px-3 py-2 font-medium">{p.name}</td>
                            <td className="px-3 py-2 text-right">{formatQty(p.quantity)}</td>
                            <td className="px-3 py-2 text-right">
                              <MoneyDisplay value={p.revenue} className="font-semibold" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Zero-Sale Products ({report.zeroSaleProducts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.zeroSaleProducts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Every active product had at least one sale in this period.
                  </p>
                ) : (
                  <ul className="max-h-72 divide-y overflow-y-auto text-sm">
                    {report.zeroSaleProducts.map((z) => (
                      <li key={z.vegetableId} className="flex items-center justify-between py-2">
                        <span className="truncate font-medium">{z.name}</span>
                        <span className="text-muted-foreground text-xs">
                          Stock: {formatQty(z.currentStock)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
