import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, ClipboardList, Trash2, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { useWastageReport } from '@/features/report/hooks'
import { fmtDate, fmtDateTime, todayIST } from '@/lib/dates'
import { formatMoney, formatQty } from '@/lib/money'

export function WastageReportPanel() {
  const { t } = useTranslation()
  const [date, setDate] = useState<string>(() => todayIST())
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')

  const report = useWastageReport(date)

  if (report.isPending || report.isLoading) {
    return (
      <Card className="space-y-3 p-4">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-32 rounded-xl" />
      </Card>
    )
  }

  if (report.isError || !report.data) {
    return <ErrorState onRetry={() => void report.refetch()} />
  }

  const data = report.data
  const summary = period === 'daily' ? data.daily : data.weekly

  return (
    <Card className="space-y-4 p-4 sm:p-5" data-testid="wastage-report-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display flex items-center gap-2 text-lg font-bold">
            <Trash2 className="text-destructive size-5" aria-hidden />
            {t('staff.stock.wastageReportTitle', { defaultValue: 'Wastage Report' })}
          </h2>
          <p className="text-muted-foreground text-xs">
            {period === 'daily'
              ? `${t('staff.stock.dailySummary', { defaultValue: 'Daily summary' })} · ${fmtDate(data.date)}`
              : `${t('staff.stock.weeklySummary', { defaultValue: '7-day summary' })} · ${fmtDate(data.weekStart)} – ${fmtDate(data.date)}`}
            {' · '}
            {t('staff.stock.wastageCostBasisNote', {
              defaultValue: 'Estimated loss calculated from actual purchase landed cost.',
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="bg-muted inline-flex rounded-full p-0.5"
            role="tablist"
            aria-label={t('staff.stock.wastagePeriod', { defaultValue: 'Wastage period' })}
          >
            <Button
              type="button"
              role="tab"
              aria-selected={period === 'daily'}
              size="sm"
              variant={period === 'daily' ? 'default' : 'ghost'}
              onClick={() => setPeriod('daily')}
              className="rounded-full"
            >
              {t('staff.stock.dailyTab', { defaultValue: 'Daily' })}
            </Button>
            <Button
              type="button"
              role="tab"
              aria-selected={period === 'weekly'}
              size="sm"
              variant={period === 'weekly' ? 'default' : 'ghost'}
              onClick={() => setPeriod('weekly')}
              className="rounded-full"
            >
              {t('staff.stock.weeklyTab', { defaultValue: 'Weekly (7d)' })}
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="text-muted-foreground size-4" aria-hidden />
            <Input
              type="date"
              value={date}
              max={todayIST()}
              onChange={(e) => setDate(e.target.value)}
              aria-label={t('staff.stock.wastageReportDate', { defaultValue: 'Wastage report date' })}
              className="h-9 w-40 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="bg-surface-subtle/60 rounded-xl border p-3">
          <p className="text-muted-foreground text-xs font-medium">
            {t('staff.stock.wastageEntries', { defaultValue: 'Wastage entries' })}
          </p>
          <p className="font-display money-num mt-1 text-xl font-extrabold">
            {summary.totalEntries}
          </p>
        </div>

        <div className="bg-surface-subtle/60 rounded-xl border p-3">
          <p className="text-muted-foreground text-xs font-medium">
            {t('staff.stock.affectedVegetables', { defaultValue: 'Vegetables affected' })}
          </p>
          <p className="font-display money-num mt-1 text-xl font-extrabold">
            {summary.byVegetable.length}
          </p>
        </div>

        <div className="bg-tomato-light/50 border-destructive/30 rounded-xl border p-3">
          <p className="text-destructive flex items-center gap-1 text-xs font-semibold">
            <TrendingDown className="size-3.5" aria-hidden />
            {t('staff.stock.estimatedCostLoss', {
              defaultValue: 'Estimated purchase cost loss',
            })}
          </p>
          <p className="font-display text-destructive money-num mt-1 text-xl font-extrabold">
            {formatMoney(summary.totalEstimatedLoss)}
          </p>
        </div>
      </div>

      {summary.totalEntries === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-7" aria-hidden />}
          title={t('staff.stock.noWastageInPeriod', {
            defaultValue: 'No wastage recorded for this period',
          })}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Breakdown by Reason */}
          <div className="space-y-2 rounded-xl border p-3.5">
            <h3 className="font-display text-sm font-bold">
              {t('staff.stock.byReason', { defaultValue: 'By reason' })}
            </h3>
            <ul className="divide-border divide-y text-sm">
              {summary.byReason.map((r) => (
                <li
                  key={r.reason}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.reason}</Badge>
                    <span className="text-muted-foreground text-xs">
                      ({r.entries} {r.entries === 1 ? 'entry' : 'entries'})
                    </span>
                  </div>
                  <div className="text-right text-xs">
                    <span className="money-num font-semibold">
                      {formatQty(r.totalQuantity)}
                    </span>
                    <span className="text-muted-foreground mx-1.5">·</span>
                    <MoneyDisplay
                      value={r.estimatedLoss}
                      className="text-destructive font-bold"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Breakdown by Vegetable */}
          <div className="space-y-2 rounded-xl border p-3.5">
            <h3 className="font-display text-sm font-bold">
              {t('staff.stock.byVegetable', { defaultValue: 'By vegetable' })}
            </h3>
            <ul className="divide-border max-h-60 divide-y overflow-y-auto text-sm">
              {summary.byVegetable.map((v) => (
                <li
                  key={String(v.vegetableId)}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <VegetableImage nameEn={v.nameEn} size="xs" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{v.nameEn}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {v.avgPurchaseCostPerUnit !== null
                          ? `Avg cost: ${formatMoney(v.avgPurchaseCostPerUnit)}/${v.baseUnit}`
                          : t('staff.stock.noCostData', { defaultValue: 'No purchase cost data' })}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <Badge variant="destructive">
                      {formatQty(v.quantity)} {v.baseUnit}
                    </Badge>
                    {v.estimatedLoss !== null && (
                      <p className="text-destructive money-num mt-0.5 font-bold">
                        {formatMoney(v.estimatedLoss)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Detailed Recent Wastage Entries Log */}
      {data.entries.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm font-bold">
            {t('staff.stock.wastageLogTitle', { defaultValue: 'Recent wastage log (7 days)' })}
          </h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">{t('common.date', { defaultValue: 'Date / Time' })}</th>
                  <th className="px-3 py-2">{t('staff.catalog.nameEn', { defaultValue: 'Vegetable' })}</th>
                  <th className="px-3 py-2">{t('staff.stock.quantity')}</th>
                  <th className="px-3 py-2">{t('staff.stock.reason', { defaultValue: 'Reason' })}</th>
                  <th className="px-3 py-2">{t('staff.stock.recordedBy', { defaultValue: 'Staff' })}</th>
                  <th className="px-3 py-2 text-right">
                    {t('staff.stock.estLossShort', { defaultValue: 'Est. Cost Loss' })}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.entries.map((entry) => (
                  <tr key={String(entry.id)}>
                    <td className="text-muted-foreground whitespace-nowrap px-3 py-2 text-xs">
                      {fmtDateTime(entry.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-semibold">{entry.vegetableName}</td>
                    <td className="money-num whitespace-nowrap px-3 py-2 font-semibold">
                      {formatQty(entry.quantity)} {entry.baseUnit}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="mr-1.5">
                        {entry.reason}
                      </Badge>
                      {entry.note && entry.note.toLowerCase() !== entry.reason.toLowerCase() && (
                        <span className="text-muted-foreground text-xs">{entry.note}</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {entry.createdByName ?? `#${entry.createdBy ?? '-'}`}
                    </td>
                    <td className="money-num whitespace-nowrap px-3 py-2 text-right font-bold">
                      {entry.estimatedLoss !== null ? (
                        <MoneyDisplay value={entry.estimatedLoss} className="text-destructive" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}
