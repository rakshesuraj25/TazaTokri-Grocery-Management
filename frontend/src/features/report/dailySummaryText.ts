import { formatMoney, formatQty } from '@/lib/money'
import type { DailyReportResponse } from './types'

export function buildDailyClosingWhatsAppText(report: DailyReportResponse): string {
  const payments =
    report.byPayment.length > 0
      ? report.byPayment.map((p) => `  - ${p.method}: ${p.bills} bills, ${formatMoney(p.total)}`)
      : ['  - None recorded']

  const wastage =
    report.wastage.length > 0
      ? report.wastage.map((w) => `  - ${w.name}: ${formatQty(w.quantity)}`)
      : ['  - None recorded']

  return [
    `TazaTokri Daily Closing (${report.date})`,
    `Sales: ${formatMoney(report.totalSales)} (${report.totalBills} bills)`,
    `Average bill: ${formatMoney(report.averageBill)}`,
    `Purchases spend today (not profit): ${formatMoney(report.purchaseSpend)}`,
    'Payments:',
    ...payments,
    'Wastage:',
    ...wastage,
  ].join('\n')
}
