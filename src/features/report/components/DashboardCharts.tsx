import { useTranslation } from 'react-i18next'
import { BarChart3, CreditCard } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { StockMeter } from '@/components/StockMeter'
import { VegetableImage } from '@/components/VegetableImage'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { dec, formatMoney, formatQty } from '@/lib/money'
import type { DailyReportResponse } from '../types'

const DONUT_COLOURS = ['#245C3B', '#E5A11A', '#C84432', '#866344']

interface DashboardChartsProps {
  report: DailyReportResponse
  catalogById: Map<string, StaffCatalogItem>
}

export function DashboardCharts({ report, catalogById }: DashboardChartsProps) {
  const { t } = useTranslation()

  const chartData = report.topItems.map((item) => ({
    name: item.name,
    revenue: dec(item.revenue).toNumber(),
    quantity: formatQty(item.quantity),
  }))

  const paymentChartData = report.byPayment.map((p) => ({
    name: p.method,
    value: dec(p.total).toNumber(),
    bills: p.bills,
  }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('staff.dashboard.topItems')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="size-8" aria-hidden />}
                title={t('common.noData')}
              />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" tickFormatter={(v: number) => `₹${v}`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => formatMoney(value)} />
                    <Bar dataKey="revenue" fill="#245C3B" maxBarSize={24} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('staff.dashboard.paymentSplit')}</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentChartData.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="size-8" aria-hidden />}
                title={t('common.noData')}
              />
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-2">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {paymentChartData.map((entry, idx) => (
                          <Cell
                            key={entry.name}
                            fill={DONUT_COLOURS[idx % DONUT_COLOURS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatMoney(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="divide-border divide-y text-xs">
                  {report.byPayment.map((p, idx) => (
                    <li key={p.method} className="flex items-center justify-between py-2.5">
                      <span className="flex items-center gap-2 font-semibold">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: DONUT_COLOURS[idx % DONUT_COLOURS.length] }}
                        />
                        {p.method} ({p.bills})
                      </span>
                      <span className="money-num font-bold">{formatMoney(p.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('staff.dashboard.wastage')}</CardTitle>
          </CardHeader>
          <CardContent>
            {report.wastage.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('common.noData')}</p>
            ) : (
              <ul className="divide-border divide-y text-sm">
                {report.wastage.map((w) => {
                  const vegMeta = catalogById.get(String(w.vegetableId))
                  const unit = vegMeta?.baseUnit
                  return (
                    <li
                      key={String(w.vegetableId)}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <VegetableImage
                          nameEn={w.name}
                          imageUrl={vegMeta?.imageUrl}
                          category={vegMeta?.category}
                          size="xs"
                        />
                        <span className="truncate">{w.name}</span>
                      </div>
                      <Badge variant="destructive">
                        {formatQty(w.quantity)}
                        {unit ? ` ${unit}` : ''}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{t('staff.dashboard.currentStock')}</CardTitle>
            <Badge variant="secondary">{report.stock.length}</Badge>
          </CardHeader>
          <CardContent>
            {report.stock.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('common.noData')}</p>
            ) : (
              <ul className="divide-border max-h-72 divide-y overflow-y-auto">
                {report.stock.map((s) => {
                  const vegMeta = catalogById.get(String(s.vegetableId))
                  const unit = vegMeta?.baseUnit
                  return (
                    <li key={String(s.vegetableId)} className="space-y-2 py-3 first:pt-0">
                      <div className="flex items-center gap-2.5">
                        <VegetableImage
                          nameEn={s.name}
                          imageUrl={vegMeta?.imageUrl}
                          category={vegMeta?.category}
                          size="xs"
                        />
                        <span className="font-display truncate text-sm font-bold">{s.name}</span>
                      </div>
                      <StockMeter quantity={s.quantity} unitLabel={unit} showLabel />
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
