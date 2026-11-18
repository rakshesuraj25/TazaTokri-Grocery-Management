import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownUp,
  BarChart3,
  Clock,
  Coins,
  Layers,
  Search,
  Tag,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Stat } from '@/components/Stat'
import { addDaysIST, fmtDate, todayIST } from '@/lib/dates'
import { formatInr, formatQty } from '@/lib/money'
import {
  MarkdownPriceDialog,
  type MarkdownTargetVegetable,
} from '@/features/pricing/components/MarkdownPriceDialog'
import { useBusinessIntelligenceReport } from '../hooks'

type DatePreset = 'TODAY' | 'LAST_7' | 'LAST_30' | 'CUSTOM'
type BiTab = 'SALES_PROFIT' | 'VALUATION' | 'MOVEMENTS' | 'BATCHES'

export function BusinessIntelligencePanel() {
  const { t } = useTranslation()
  const today = useMemo(() => todayIST(), [])
  const [preset, setPreset] = useState<DatePreset>('LAST_7')
  const [fromDate, setFromDate] = useState<string>(() => addDaysIST(today, -6))
  const [toDate, setToDate] = useState<string>(() => today)
  const [activeTab, setActiveTab] = useState<BiTab>('SALES_PROFIT')
  const [search, setSearch] = useState('')
  const [markdownTarget, setMarkdownTarget] = useState<MarkdownTargetVegetable | null>(null)

  const handlePreset = (next: DatePreset) => {
    setPreset(next)
    if (next === 'TODAY') {
      setFromDate(today)
      setToDate(today)
    } else if (next === 'LAST_7') {
      setFromDate(addDaysIST(today, -6))
      setToDate(today)
    } else if (next === 'LAST_30') {
      setFromDate(addDaysIST(today, -29))
      setToDate(today)
    }
  }

  const biQuery = useBusinessIntelligenceReport(fromDate, toDate)
  const bi = biQuery.data

  const filteredValuation = useMemo(() => {
    const items = bi?.inventoryValuation.items ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.nameEn.toLowerCase().includes(q) ||
        (i.nameMr ?? '').toLowerCase().includes(q) ||
        (i.nameHi ?? '').toLowerCase().includes(q),
    )
  }, [bi?.inventoryValuation.items, search])

  const filteredMovements = useMemo(() => {
    const items = bi?.stockMovements ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.nameEn.toLowerCase().includes(q) ||
        (i.nameMr ?? '').toLowerCase().includes(q) ||
        (i.nameHi ?? '').toLowerCase().includes(q),
    )
  }, [bi?.stockMovements, search])

  return (
    <Card
      data-testid="business-intelligence-panel"
      className="border-border bg-card space-y-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display flex items-center gap-2 text-lg font-bold">
            <BarChart3 className="text-primary size-5" aria-hidden />
            {t('bi.title', {
              defaultValue: 'Inventory & Business Intelligence',
            })}
          </h2>
          <p className="text-muted-foreground text-xs">
            {t('bi.subtitle', {
              defaultValue:
                'Inventory valuation at actual purchase landed cost, stock movement ledger, sales split & estimated gross margin.',
            })}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-1.5">
          {(
            [
              ['TODAY', t('bi.filterToday', { defaultValue: 'Today' })],
              ['LAST_7', t('bi.filterLast7', { defaultValue: 'Last 7 days' })],
              ['LAST_30', t('bi.filterLast30', { defaultValue: 'Last 30 days' })],
              ['CUSTOM', t('bi.filterCustom', { defaultValue: 'Custom' })],
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
        </div>
      </div>

      {preset === 'CUSTOM' && (
        <div className="no-print bg-surface-subtle flex flex-wrap items-center gap-2 rounded-xl p-2.5 text-xs">
          <span className="font-semibold">
            {t('bi.fromDate', { defaultValue: 'From' })}:
          </span>
          <Input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <span className="font-semibold">{t('bi.toDate', { defaultValue: 'To' })}:</span>
          <Input
            type="date"
            value={toDate}
            min={fromDate}
            max={today}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
      )}

      {bi && (
        <>
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label={t('bi.inventoryValueLabel', {
                defaultValue: 'Estimated Inventory Value',
              })}
              value={formatInr(bi.inventoryValuation.totalEstimatedValue)}
              hint={t('bi.inventoryValueHint', {
                defaultValue: `${bi.inventoryValuation.costedVegetablesCount} costed · ${bi.inventoryValuation.uncostedVegetablesCount} uncosted`,
              })}
              tone="neutral"
              icon={<Layers className="size-5" />}
            />
            <Stat
              label={t('bi.periodRevenueLabel', {
                defaultValue: 'Period Total Revenue',
              })}
              value={formatInr(bi.salesPerformance.periodTotalRevenue)}
              hint={`${bi.salesPerformance.periodTotalTransactions} bills · Avg ${formatInr(bi.salesPerformance.averageTransactionValue)}`}
              tone="positive"
              icon={<TrendingUp className="size-5" />}
            />
            <Stat
              label={t('bi.grossProfitLabel', {
                defaultValue: 'Estimated Gross Profit',
              })}
              value={formatInr(bi.profitability.estimatedGrossProfit)}
              hint={`Margin: ${bi.profitability.grossMarginPercent}% · COGS: ${formatInr(bi.profitability.estimatedCogs)}`}
              tone={
                Number(bi.profitability.estimatedGrossProfit) >= 0 ? 'positive' : 'warning'
              }
              icon={<Coins className="size-5" />}
            />
            <Stat
              label={t('bi.netContributionLabel', {
                defaultValue: 'Est. Net Contribution',
              })}
              value={formatInr(bi.profitability.estimatedNetContribution)}
              hint={`After wastage loss (${formatInr(bi.profitability.wastageCost)})`}
              tone={
                Number(bi.profitability.estimatedNetContribution) >= 0
                  ? 'positive'
                  : 'danger'
              }
              icon={<ArrowDownUp className="size-5" />}
            />
          </div>

          {/* Section Switcher Tabs */}
          <div className="no-print border-border flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {(
                [
                  [
                    'SALES_PROFIT',
                    t('bi.tabSalesProfit', { defaultValue: 'Sales & Profitability' }),
                  ],
                  [
                    'VALUATION',
                    t('bi.tabValuation', { defaultValue: 'Inventory Valuation' }),
                  ],
                  [
                    'MOVEMENTS',
                    t('bi.tabMovements', { defaultValue: 'Stock Movement Ledger' }),
                  ],
                  [
                    'BATCHES',
                    t('bi.tabBatches', {
                      defaultValue: 'Freshness & Purchase Batches',
                    }),
                  ],
                ] as const
              ).map(([tabKey, label]) => (
                <button
                  key={tabKey}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tabKey}
                  onClick={() => setActiveTab(tabKey)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === tabKey
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-subtle text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {(activeTab === 'VALUATION' || activeTab === 'MOVEMENTS') && (
              <div className="relative w-52">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-2 left-2.5 size-3.5"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('bi.searchVegetable', {
                    defaultValue: 'Filter vegetable...',
                  })}
                  className="h-7 pl-8 text-xs"
                />
              </div>
            )}
          </div>

          {/* TAB 1: SALES & PROFITABILITY */}
          {activeTab === 'SALES_PROFIT' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-surface-subtle space-y-3 rounded-xl p-3.5 text-xs">
                <h3 className="font-display text-sm font-bold">
                  {t('bi.salesChannelBreakdown', {
                    defaultValue: 'Sales Performance & Channel Split',
                  })}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-card rounded-lg border p-2.5">
                    <p className="text-muted-foreground text-[11px]">
                      {t('bi.todaySales', { defaultValue: 'Today' })}
                    </p>
                    <p className="font-display text-sm font-extrabold">
                      {formatInr(bi.salesPerformance.todayRevenue)}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg border p-2.5">
                    <p className="text-muted-foreground text-[11px]">
                      {t('bi.weekSales', { defaultValue: 'Last 7 Days' })}
                    </p>
                    <p className="font-display text-sm font-extrabold">
                      {formatInr(bi.salesPerformance.weekRevenue)}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg border p-2.5">
                    <p className="text-muted-foreground text-[11px]">
                      {t('bi.monthSales', { defaultValue: 'Last 30 Days' })}
                    </p>
                    <p className="font-display text-sm font-extrabold">
                      {formatInr(bi.salesPerformance.monthRevenue)}
                    </p>
                  </div>
                </div>

                <div className="divide-border bg-card divide-y rounded-lg border p-2.5">
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">
                      {t('bi.counterQuickSales', {
                        defaultValue: 'Counter Sales (Quick Sale POS)',
                      })}
                    </span>
                    <span className="font-semibold">
                      {formatInr(bi.salesPerformance.counterSalesRevenue)} (
                      {bi.salesPerformance.counterSalesCount})
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">
                      {t('bi.customerOnlineOrders', {
                        defaultValue: 'Customer Delivery Orders',
                      })}
                    </span>
                    <span className="font-semibold">
                      {formatInr(bi.salesPerformance.onlineOrdersRevenue)} (
                      {bi.salesPerformance.onlineOrdersCount})
                    </span>
                  </div>
                  {bi.salesPerformance.paymentBreakdown.map((pm) => (
                    <div
                      key={`${pm.channel}-${pm.method}`}
                      className="flex justify-between py-1 text-[11px]"
                    >
                      <span className="text-muted-foreground">
                        {pm.channel} • {pm.method}
                      </span>
                      <span>
                        {formatInr(pm.amount)} ({pm.transactions})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-subtle space-y-3 rounded-xl p-3.5 text-xs">
                <h3 className="font-display text-sm font-bold">
                  {t('bi.profitAndMarginTitle', {
                    defaultValue: 'Estimated Profit & Margin Breakdown',
                  })}
                </h3>
                <div className="divide-border bg-card divide-y rounded-lg border p-2.5">
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">
                      {t('bi.merchandiseRevenue', {
                        defaultValue: 'Product Revenue (Excl. Delivery Fees)',
                      })}
                    </span>
                    <span className="font-semibold">
                      {formatInr(bi.profitability.merchandiseRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">
                      {t('bi.costedMerchRevenue', {
                        defaultValue: 'Revenue with Recorded Purchase Cost',
                      })}
                    </span>
                    <span className="font-semibold">
                      {formatInr(bi.profitability.costedMerchandiseRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">
                      {t('bi.estimatedCogs', {
                        defaultValue: 'Vegetable COGS (Purchase Landed Cost)',
                      })}
                    </span>
                    <span className="font-semibold">
                      - {formatInr(bi.profitability.estimatedCogs)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold">
                    <span>
                      {t('bi.estimatedGrossProfit', {
                        defaultValue: 'Estimated Gross Profit',
                      })}
                    </span>
                    <span className="text-primary">
                      {formatInr(bi.profitability.estimatedGrossProfit)} (
                      {bi.profitability.grossMarginPercent}%)
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">
                      {t('bi.wastageCost', {
                        defaultValue: 'Recorded Wastage Cost',
                      })}
                    </span>
                    <span className="text-destructive font-semibold">
                      - {formatInr(bi.profitability.wastageCost)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold">
                    <span>
                      {t('bi.estimatedNetContribution', {
                        defaultValue: 'Estimated Net Contribution',
                      })}
                    </span>
                    <span>{formatInr(bi.profitability.estimatedNetContribution)}</span>
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {t('bi.profitabilityEstimateDisclaimer', {
                    defaultValue:
                      'Note: Gross profit and net contribution are estimates based strictly on recorded purchase landed costs and exclude shop rent, utilities, and uncosted items.',
                  })}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY VALUATION */}
          {activeTab === 'VALUATION' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-border text-muted-foreground border-b">
                    <th className="py-2 pr-3 font-semibold">
                      {t('staff.stock.vegetable', { defaultValue: 'Vegetable' })}
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      {t('staff.stock.currentStock', { defaultValue: 'Current Stock' })}
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      {t('bi.avgLandedCost', { defaultValue: 'Purchase Landed Cost' })}
                    </th>
                    <th className="py-2 text-right font-semibold">
                      {t('bi.estimatedInventoryValue', {
                        defaultValue: 'Estimated Value',
                      })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filteredValuation.map((row) => (
                    <tr key={String(row.vegetableId)}>
                      <td className="py-2 pr-3 font-medium">
                        {row.nameEn}
                        {row.nameMr ? (
                          <span className="text-muted-foreground ml-1.5 text-[11px]">
                            ({row.nameMr})
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {formatQty(row.currentStock)} {row.baseUnit}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {row.unitLandedCost !== null ? (
                          `${formatInr(row.unitLandedCost)} / ${row.baseUnit}`
                        ) : (
                          <span className="text-muted-foreground italic">
                            {t('bi.costUnavailable', {
                              defaultValue: 'Cost unavailable',
                            })}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap">
                        {row.estimatedValue !== null ? (
                          formatInr(row.estimatedValue)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: STOCK MOVEMENT LEDGER */}
          {activeTab === 'MOVEMENTS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-border text-muted-foreground border-b">
                    <th className="py-2 pr-2 font-semibold">
                      {t('staff.stock.vegetable', { defaultValue: 'Vegetable' })}
                    </th>
                    <th className="py-2 pr-2 text-right font-semibold">
                      {t('bi.openingStock', { defaultValue: 'Opening' })}
                    </th>
                    <th className="py-2 pr-2 text-right font-semibold">
                      {t('bi.purchasesIn', { defaultValue: '+ Purchases' })}
                    </th>
                    <th className="py-2 pr-2 text-right font-semibold">
                      {t('bi.onlineOrdersOut', { defaultValue: '- Online Orders' })}
                    </th>
                    <th className="py-2 pr-2 text-right font-semibold">
                      {t('bi.quickSalesOut', { defaultValue: '- Quick Sale' })}
                    </th>
                    <th className="py-2 pr-2 text-right font-semibold">
                      {t('bi.wastageOut', { defaultValue: '- Wastage' })}
                    </th>
                    <th className="py-2 pr-2 text-right font-semibold">
                      {t('bi.adjustmentsNet', { defaultValue: '± Adjust' })}
                    </th>
                    <th className="py-2 text-right font-semibold">
                      {t('bi.closingStock', { defaultValue: 'Closing' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filteredMovements.map((m) => (
                    <tr key={String(m.vegetableId)}>
                      <td className="py-2 pr-2 font-medium">
                        {m.nameEn}{' '}
                        <span className="text-muted-foreground text-[10px]">
                          ({m.baseUnit})
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {formatQty(m.openingStock)}
                      </td>
                      <td className="text-primary py-2 pr-2 text-right font-medium">
                        +{formatQty(m.purchasesQty)}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        -{formatQty(m.onlineSalesNetQty)}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        -{formatQty(m.quickSalesQty)}
                      </td>
                      <td className="text-destructive py-2 pr-2 text-right">
                        -{formatQty(m.wastageQty)}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {formatQty(m.adjustmentsQty)}
                      </td>
                      <td className="py-2 text-right font-bold">
                        {formatQty(m.closingStock)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: FRESHNESS & PURCHASE BATCHES */}
          {activeTab === 'BATCHES' && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                {t('bi.freshnessBatchesHelp', {
                  defaultValue:
                    'Recent purchase batches tracked by actual purchase date and FIFO remaining stock estimate. Use Staff Markdown to apply a controlled clearance price on ageing stock.',
                })}
              </p>
              {bi.freshnessBatches.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-xs">
                  {t('bi.noPurchaseBatches', {
                    defaultValue: 'No purchase batches recorded yet.',
                  })}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b">
                        <th className="py-2 pr-2 font-semibold">
                          {t('bi.batchRef', { defaultValue: 'Batch / Date' })}
                        </th>
                        <th className="py-2 pr-2 font-semibold">
                          {t('staff.stock.vegetable', { defaultValue: 'Vegetable' })}
                        </th>
                        <th className="py-2 pr-2 font-semibold">
                          {t('staff.purchase.supplier', { defaultValue: 'Supplier' })}
                        </th>
                        <th className="py-2 pr-2 text-right font-semibold">
                          {t('bi.batchAge', { defaultValue: 'Age' })}
                        </th>
                        <th className="py-2 pr-2 text-right font-semibold">
                          {t('bi.receivedVsRem', {
                            defaultValue: 'Est. Remaining / Recv',
                          })}
                        </th>
                        <th className="py-2 pr-2 text-right font-semibold">
                          {t('bi.landedVsSelling', {
                            defaultValue: 'Cost / Selling',
                          })}
                        </th>
                        <th className="no-print py-2 text-right font-semibold">
                          {t('common.actions', { defaultValue: 'Action' })}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {bi.freshnessBatches.map((b) => {
                        const rem = Number(b.estimatedRemainingQuantity)
                        const isAgeing = b.daysSincePurchase >= 2 && rem > 0
                        return (
                          <tr key={String(b.purchaseItemId)}>
                            <td className="py-2 pr-2 whitespace-nowrap">
                              <span className="font-mono font-semibold">
                                PUR-#{b.purchaseId}
                              </span>
                              <span className="text-muted-foreground block text-[10px]">
                                {fmtDate(b.purchaseDate)}
                              </span>
                            </td>
                            <td className="py-2 pr-2 font-medium">{b.vegetableName}</td>
                            <td className="text-muted-foreground py-2 pr-2">
                              {b.supplierName}
                            </td>
                            <td className="py-2 pr-2 text-right whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isAgeing
                                    ? 'bg-turmeric-light text-turmeric-foreground'
                                    : 'bg-surface-subtle text-muted-foreground'
                                }`}
                              >
                                <Clock className="size-3" aria-hidden />
                                {b.daysSincePurchase === 0
                                  ? t('bi.todayBatch', { defaultValue: 'Today' })
                                  : `${b.daysSincePurchase}d`}
                              </span>
                            </td>
                            <td className="py-2 pr-2 text-right whitespace-nowrap">
                              <span className="font-bold">
                                {formatQty(b.estimatedRemainingQuantity)}
                              </span>{' '}
                              / {formatQty(b.receivedQuantity)} {b.baseUnit}
                            </td>
                            <td className="py-2 pr-2 text-right whitespace-nowrap">
                              {formatInr(b.landedCostPerUnit)} /{' '}
                              {b.currentSellingPrice != null
                                ? formatInr(b.currentSellingPrice)
                                : '—'}
                            </td>
                            <td className="no-print py-2 text-right">
                              {rem > 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-full px-2.5 text-[11px]"
                                  onClick={() =>
                                    setMarkdownTarget({
                                      vegetableId: b.vegetableId,
                                      nameEn: b.vegetableName,
                                      baseUnit: b.baseUnit,
                                      currentStock: b.estimatedRemainingQuantity,
                                      currentPrice: b.currentSellingPrice,
                                      landedCost: b.landedCostPerUnit,
                                    })
                                  }
                                >
                                  <Tag className="size-3" aria-hidden />
                                  {t('pricing.markdownAction', {
                                    defaultValue: 'Markdown',
                                  })}
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <MarkdownPriceDialog
        target={markdownTarget}
        onClose={() => setMarkdownTarget(null)}
      />
    </Card>
  )
}
