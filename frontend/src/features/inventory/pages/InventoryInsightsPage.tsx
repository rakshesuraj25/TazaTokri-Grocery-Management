import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Minus,
  Search,
  ShoppingBag,
  TrendingUp,
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
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { toApiError } from '@/lib/api'
import { formatMoney, formatQty } from '@/lib/money'
import {
  useInventoryInsights,
  type DemandCategory,
  type PlanningHorizon,
  type ProductDemandInsight,
  type PurchaseAction,
  type SalesTrend,
  type StockoutRisk,
} from '../insightsApi'

type RiskFilter = 'ALL' | StockoutRisk
type TrendFilter = 'ALL' | SalesTrend
type SortKey = 'RISK_ASC' | 'SUGGESTED_DESC' | 'SOLD_DESC' | 'STOCK_ASC' | 'NAME_ASC'

const RISK_ORDER: Record<StockoutRisk, number> = {
  CRITICAL: 0,
  HIGH: 1,
  LOW: 2,
  NO_DATA: 3,
}

function riskBadgeVariant(risk: StockoutRisk): 'destructive' | 'secondary' | 'outline' | 'default' {
  if (risk === 'CRITICAL') return 'destructive'
  if (risk === 'HIGH') return 'default'
  if (risk === 'LOW') return 'secondary'
  return 'outline'
}

function riskLabel(risk: StockoutRisk): string {
  if (risk === 'CRITICAL') return 'Critical'
  if (risk === 'HIGH') return 'Low Stock'
  if (risk === 'LOW') return 'Healthy'
  return 'No Sales Data'
}

function purchaseActionBadge(action?: PurchaseAction) {
  if (action === 'BUY_TODAY') {
    return <Badge variant="destructive">Buy today</Badge>
  }
  if (action === 'PURCHASE_SOON') {
    return <Badge variant="default">Purchase soon</Badge>
  }
  if (action === 'REDUCE_PURCHASE') {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-700">
        Reduce purchase
      </Badge>
    )
  }
  if (action === 'STOCK_SUFFICIENT') {
    return <Badge variant="secondary">Stock sufficient</Badge>
  }
  return <Badge variant="outline">Not enough sales data</Badge>
}

function demandCategoryLabel(category?: DemandCategory): string | null {
  if (!category) return null
  if (category === 'SELLING_WELL') return 'Selling well'
  if (category === 'INCREASING_DEMAND') return 'Increasing demand'
  if (category === 'DECREASING_DEMAND') return 'Decreasing demand'
  if (category === 'SLOW_MOVING') return 'Slow-moving'
  if (category === 'NO_SALES_HISTORY') return 'No sales history'
  return 'Insufficient sales data'
}

function TrendBadge({ trend }: { trend: SalesTrend }) {
  if (trend === 'INCREASING') {
    return (
      <Badge variant="default" className="gap-1 bg-emerald-600 text-white">
        <ArrowUpRight className="size-3" /> Increasing
      </Badge>
    )
  }
  if (trend === 'DECREASING') {
    return (
      <Badge variant="destructive" className="gap-1">
        <ArrowDownRight className="size-3" /> Decreasing
      </Badge>
    )
  }
  if (trend === 'STABLE') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Minus className="size-3" /> Steady
      </Badge>
    )
  }
  return <Badge variant="outline">No Sales Data</Badge>
}

export default function InventoryInsightsPage() {
  const [horizon, setHorizon] = useState<PlanningHorizon>(7)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL')
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('RISK_ASC')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [adjustedQty, setAdjustedQty] = useState<Record<number, string>>({})

  const query = useInventoryInsights(horizon)
  const data = query.data

  const filteredProducts = useMemo(() => {
    const items = data?.products ?? []
    const q = search.trim().toLowerCase()
    return items
      .filter((p) => {
        if (riskFilter !== 'ALL' && p.stockoutRisk !== riskFilter) return false
        if (trendFilter !== 'ALL' && p.salesTrend !== trendFilter) return false
        if (!q) return true
        return p.name.toLowerCase().includes(q) || p.unit.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (sortBy === 'RISK_ASC') {
          const r = RISK_ORDER[a.stockoutRisk] - RISK_ORDER[b.stockoutRisk]
          if (r !== 0) return r
          return Number(b.suggestedPurchaseQty) - Number(a.suggestedPurchaseQty)
        }
        if (sortBy === 'SUGGESTED_DESC') {
          return Number(b.suggestedPurchaseQty) - Number(a.suggestedPurchaseQty)
        }
        if (sortBy === 'SOLD_DESC') {
          return Number(b.totalQtySold30d) - Number(a.totalQtySold30d)
        }
        if (sortBy === 'STOCK_ASC') {
          return Number(a.currentStock) - Number(b.currentStock)
        }
        return a.name.localeCompare(b.name)
      })
  }, [data, search, riskFilter, trendFilter, sortBy])

  const unitSummaryText = useMemo(() => {
    if (!data?.totalInventoryByUnit) return '—'
    const entries = Object.entries(data.totalInventoryByUnit)
    if (entries.length === 0) return '0'
    return entries.map(([unit, qty]) => `${formatQty(qty)} ${unit}`).join(' · ')
  }, [data])

  const chartData = useMemo(() => {
    return (data?.bestSelling ?? []).map((item) => ({
      name: item.name,
      sold30d: Number(item.totalQtySold30d),
      stock: Number(item.currentStock),
    }))
  }, [data])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title="Inventory Forecasting & Demand Insights"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Demand Insights' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-muted inline-flex rounded-full p-1" role="group" aria-label="Planning horizon">
              {([3, 7, 14] as PlanningHorizon[]).map((days) => (
                <Button
                  key={days}
                  type="button"
                  size="sm"
                  variant={horizon === days ? 'default' : 'ghost'}
                  className="rounded-full text-xs"
                  onClick={() => setHorizon(days)}
                >
                  {days} Days
                </Button>
              ))}
            </div>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/staff/purchases/new">
                <ShoppingBag className="size-4" /> New Purchase
              </Link>
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <Card className="rounded-3xl p-6 text-center text-sm text-muted-foreground">
          Loading demand insights...
        </Card>
      ) : query.isError ? (
        <ErrorState
          message={toApiError(query.error).message}
          onRetry={() => void query.refetch()}
        />
      ) : !data || data.products.length === 0 ? (
        <EmptyState
          title="No active products found"
          description="Add active vegetables to start tracking demand and stockout risk."
        />
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat
              label="Actively Selling"
              value={data.activelySellingCount}
              hint={`of ${data.totalActiveProducts} active`}
            />
            <Stat
              label="At Risk of Stockout"
              value={data.atRiskCount}
              hint={`${data.criticalRiskCount} critical · ${data.highRiskCount} low stock`}
              tone={data.criticalRiskCount > 0 ? 'danger' : undefined}
            />
            <Stat
              label="Slow-Moving / Falling"
              value={data.lowDemandCount}
              hint={
                data.noSalesHistoryCount !== undefined
                  ? `${data.noSalesHistoryCount} without enough sales data`
                  : undefined
              }
            />
            <Stat label="Available Inventory" value={unitSummaryText} />
            <Stat
              label="Est. Inventory Value"
              value={
                data.estimatedInventoryValue !== null
                  ? formatMoney(data.estimatedInventoryValue)
                  : 'N/A'
              }
              hint={
                data.valuedProductsCount > 0
                  ? `${data.valuedProductsCount} valued · ${data.uncostedProductsCount} uncosted`
                  : 'No reliable cost data'
              }
            />
          </div>

          {/* Sales Trend & Best-Selling Insights */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-3xl border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4" /> Best-Selling Vegetables (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No completed sales in the last 30 days.
                  </p>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="sold30d" name="Sold (30d)" fill="#15803d" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="stock" name="Current Stock" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card className="rounded-3xl border p-4">
                <h3 className="mb-2 text-sm font-bold text-emerald-700">Increasing Demand</h3>
                {data.increasingDemand.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No products trending up.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {data.increasingDemand.map((p) => (
                      <li key={p.vegetableId} className="flex items-center justify-between">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-emerald-700">
                          {formatQty(p.avgDailyLast7d)} {p.unit}/d
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="rounded-3xl border p-4">
                <h3 className="mb-2 text-sm font-bold text-rose-700">Decreasing Demand</h3>
                {data.decreasingDemand.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No products trending down.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {data.decreasingDemand.map((p) => (
                      <li key={p.vegetableId} className="flex items-center justify-between">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-rose-700">
                          {formatQty(p.avgDailyLast7d)} {p.unit}/d
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="rounded-3xl border p-4 sm:col-span-2">
                <h3 className="mb-2 text-sm font-bold">Slow-Moving & Wastage Risk</h3>
                {data.slowMoving.length === 0 && (!data.wastageRiskProducts || data.wastageRiskProducts.length === 0) ? (
                  <p className="text-muted-foreground text-xs">
                    No slow-moving or overstocked items flagged right now.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.slowMoving.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {data.slowMoving.map((p) => (
                          <Badge key={p.vegetableId} variant="outline" className="text-xs">
                            {p.name}: {formatQty(p.totalQtySold30d)} {p.unit} sold (30d)
                          </Badge>
                        ))}
                      </div>
                    )}
                    {data.wastageRiskProducts && data.wastageRiskProducts.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-amber-700">Overstocked (reduce buying):</span>
                        {data.wastageRiskProducts.map((p) => (
                          <Badge
                            key={`waste-${p.vegetableId}`}
                            variant="outline"
                            className="border-amber-500 text-xs text-amber-700"
                          >
                            {p.name} ({p.daysRemaining !== null ? `${p.daysRemaining}d stock` : 'Overstocked'})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products or unit..."
                className="rounded-full pl-9"
              />
            </div>
            <select
              aria-label="Filter by stockout risk"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
              className="border-input bg-background h-10 rounded-full border px-3 text-xs font-medium"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="CRITICAL">Critical (1–2d)</option>
              <option value="HIGH">Low Stock (3–5d)</option>
              <option value="LOW">Healthy Stock</option>
              <option value="NO_DATA">No Sales Data</option>
            </select>
            <select
              aria-label="Filter by sales trend"
              value={trendFilter}
              onChange={(e) => setTrendFilter(e.target.value as TrendFilter)}
              className="border-input bg-background h-10 rounded-full border px-3 text-xs font-medium"
            >
              <option value="ALL">All Trends</option>
              <option value="INCREASING">Increasing</option>
              <option value="STABLE">Steady</option>
              <option value="DECREASING">Decreasing</option>
              <option value="NO_DATA">No Sales Data</option>
            </select>
            <select
              aria-label="Sort products"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="border-input bg-background h-10 rounded-full border px-3 text-xs font-medium"
            >
              <option value="RISK_ASC">Highest Risk First</option>
              <option value="SUGGESTED_DESC">Highest Suggested Buy</option>
              <option value="SOLD_DESC">Most Sold (30d)</option>
              <option value="STOCK_ASC">Lowest Stock First</option>
              <option value="NAME_ASC">Name (A–Z)</option>
            </select>
          </div>

          {/* Product Forecast Table */}
          {filteredProducts.length === 0 ? (
            <EmptyState title="No matching products" description="Try adjusting your filters." />
          ) : (
            <div className="space-y-2.5">
              {filteredProducts.map((p: ProductDemandInsight) => {
                const isExpanded = expandedId === p.vegetableId
                const suggestedVal =
                  adjustedQty[p.vegetableId] ?? String(p.suggestedPurchaseQty)
                return (
                  <Card key={p.vegetableId} className="rounded-3xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold">{p.name}</span>
                          <Badge variant={riskBadgeVariant(p.stockoutRisk)}>
                            {p.stockoutRisk === 'CRITICAL' && (
                              <AlertTriangle className="mr-1 size-3" />
                            )}
                            {riskLabel(p.stockoutRisk)}
                          </Badge>
                          {p.purchaseAction && purchaseActionBadge(p.purchaseAction)}
                          <TrendBadge trend={p.salesTrend} />
                          {p.demandCategory === 'SLOW_MOVING' && (
                            <Badge variant="outline" className="text-xs">
                              {demandCategoryLabel(p.demandCategory)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Stock: <strong>{formatQty(p.currentStock)} {p.unit}</strong> · Sold (7d):{' '}
                          <strong>{formatQty(p.totalQtySold7d)} {p.unit}</strong> · Sold (30d):{' '}
                          <strong>{formatQty(p.totalQtySold30d)} {p.unit}</strong> ({p.orderCount30d}{' '}
                          orders) · Avg/day: <strong>{formatQty(p.avgDailyDemand)} {p.unit}</strong> ·
                          Days left:{' '}
                          <strong>
                            {p.daysRemaining !== null ? `${p.daysRemaining}d` : 'N/A'}
                          </strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <label
                            htmlFor={`buy-${p.vegetableId}`}
                            className="text-muted-foreground text-xs font-medium"
                          >
                            Buy ({p.unit}):
                          </label>
                          <Input
                            id={`buy-${p.vegetableId}`}
                            type="number"
                            step="0.5"
                            min="0"
                            value={suggestedVal}
                            onChange={(e) =>
                              setAdjustedQty((prev) => ({
                                ...prev,
                                [p.vegetableId]: e.target.value,
                              }))
                            }
                            className="h-8 w-24 text-xs"
                          />
                        </div>
                        <Button asChild size="sm" variant="outline" className="rounded-full text-xs">
                          <Link to="/staff/purchases/new">Purchase</Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Toggle details for ${p.name}`}
                          onClick={() =>
                            setExpandedId(isExpanded ? null : p.vegetableId)
                          }
                        >
                          {isExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                        <p className="font-medium text-foreground">
                          Recommendation: {p.recommendationReason}
                        </p>
                        <div className="text-muted-foreground flex flex-wrap gap-4">
                          <span>7-day avg: {formatQty(p.avgDailyLast7d)} {p.unit}/day</span>
                          <span>30-day avg: {formatQty(p.avgDailyLast30d)} {p.unit}/day</span>
                          <span>
                            {data.planningHorizonDays}-day forecast demand:{' '}
                            {formatQty(p.forecastDemand)} {p.unit}
                          </span>
                          {p.estimatedStockValue !== null && (
                            <span>Est. stock value: {formatMoney(p.estimatedStockValue)}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
