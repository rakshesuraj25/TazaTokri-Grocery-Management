import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  MessageCircle,
  Monitor,
  Package,
  Plus,
  Printer,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Warehouse,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { StatGridSkeleton } from '@/components/Skeletons'
import { useStaffCatalog } from '@/features/catalog/hooks'
import { usePhotoAvailability } from '@/features/catalog/usePhotoAvailability'
import { EXPECTED_VEGETABLE_IMAGES, vegetableSlug } from '@/features/catalog/vegetableImages'
import { useStaffOrders } from '@/features/orders/hooks'
import { usePendingCash } from '@/features/payments/hooks'
import { useCurrentPrices } from '@/features/pricing/hooks'
import { usePurchases } from '@/features/purchase/hooks'
import { isLowStock } from '@/lib/businessRules'
import { todayIST } from '@/lib/dates'
import { dec, formatMoney, sumMoney } from '@/lib/money'
import { useDailyReport } from '../hooks'
import { detectSampleData } from '../sampleDataDetector'
import { buildDailyClosingWhatsAppText } from '../dailySummaryText'
import { buildDashboardAttentionItems } from '../dashboardHelpers'
import { LaunchChecklist } from '../components/LaunchChecklist'
import { NeedsAttentionCard } from '../components/NeedsAttentionCard'
import { DashboardOperationalCards } from '../components/DashboardOperationalCards'
import { DashboardRecentActivity } from '../components/DashboardRecentActivity'
import { DashboardCharts } from '../components/DashboardCharts'
import { BusinessIntelligencePanel } from '../components/BusinessIntelligencePanel'
import { OperationalHealthCard } from '../components/OperationalHealthCard'

export default function DashboardPage() {
  const { t } = useTranslation()
  const [date, setDate] = useState<string>(() => todayIST())
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const report = useDailyReport(date)
  const currentPrices = useCurrentPrices()
  const staffCatalog = useStaffCatalog()
  const staffOrders = useStaffOrders({ date })
  const pendingCash = usePendingCash()
  const recentPurchases = usePurchases(0, true)

  const activePrices = useMemo(() => currentPrices.data ?? [], [currentPrices.data])
  const sampleCheck = useMemo(
    () => detectSampleData(activePrices, report.data?.purchaseSpend),
    [activePrices, report.data?.purchaseSpend],
  )

  const catalogById = useMemo(
    () => new Map((staffCatalog.data ?? []).map((v) => [String(v.id), v])),
    [staffCatalog.data],
  )

  const ordersStats = useMemo(() => {
    const all = staffOrders.data ?? []
    const waiting = all.filter(
      (o) => o.status === 'PLACED' || o.status === 'CONFIRMED' || o.status === 'PACKED',
    ).length
    const completed = all.filter((o) => o.status === 'DELIVERED').length
    return {
      total: all.length,
      waiting,
      completed,
    }
  }, [staffOrders.data])

  const cashHeldTotal = useMemo(
    () => sumMoney((pendingCash.data ?? []).map((p) => p.amount)),
    [pendingCash.data],
  )

  const photoTargets = useMemo(
    () =>
      staffCatalog.data && staffCatalog.data.length > 0
        ? staffCatalog.data
        : EXPECTED_VEGETABLE_IMAGES,
    [staffCatalog.data],
  )
  const photoStatuses = usePhotoAvailability(photoTargets)
  const missingPhotosCount = useMemo(
    () =>
      photoTargets.filter((v) => photoStatuses[vegetableSlug(v.nameEn)] !== 'photo').length,
    [photoTargets, photoStatuses],
  )

  const outOfStockItems = useMemo(
    () => (staffCatalog.data ?? []).filter((v) => dec(v.stock).lte(0)),
    [staffCatalog.data],
  )
  const lowStockItems = useMemo(
    () => (staffCatalog.data ?? []).filter((v) => isLowStock(v.stock, v.baseUnit)),
    [staffCatalog.data],
  )

  const attentionItems = useMemo(
    () =>
      buildDashboardAttentionItems({
        catalog: staffCatalog.data ?? [],
        orders: staffOrders.data ?? [],
        cashHeldAmounts: (pendingCash.data ?? []).map((p) => p.amount),
        missingPhotosCount,
        totalPhotoTargets: photoTargets.length,
        t,
      }),
    [staffCatalog.data, staffOrders.data, pendingCash.data, missingPhotosCount, photoTargets.length, t],
  )

  if (report.isPending || report.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-5">
        <StatGridSkeleton count={4} />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    )
  }

  if (report.isError || !report.data) {
    return <ErrorState onRetry={() => void report.refetch()} />
  }

  const r = report.data
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(buildDailyClosingWhatsAppText(r))}`

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title={t('staff.dashboard.title')}
        subtitle={t('staff.dashboard.subtitle', {
          defaultValue: 'Daily sales, inventory health, orders & store activity.',
        })}
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={date}
              max={todayIST()}
              onChange={(e) => setDate(e.target.value)}
              aria-label={t('staff.dashboard.reportDate', { defaultValue: 'Report date' })}
              className="w-40"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="rounded-full">
              <Printer className="size-4" aria-hidden />
              {t('common.print', { defaultValue: 'Print' })}
            </Button>
            <Button asChild variant="secondary" size="sm" className="rounded-full">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden />
                {t('staff.dashboard.whatsappSummary', { defaultValue: 'WhatsApp' })}
              </a>
            </Button>
          </div>
        }
      />

      {/* Quick Actions Strip */}
      <div className="no-print flex flex-wrap gap-2">
        <Button asChild size="sm" className="rounded-full">
          <Link to="/staff/sale">
            <ShoppingCart className="size-4" aria-hidden />
            {t('nav.sale')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/staff/purchases/new">
            <Plus className="size-4" aria-hidden />
            {t('staff.purchase.newPurchase')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/staff/stock">
            <Warehouse className="size-4" aria-hidden />
            {t('nav.stock')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/staff/orders">
            <Package className="size-4" aria-hidden />
            {t('nav.ordersStaff')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/display/prices">
            <Monitor className="size-4" aria-hidden />
            {t('staff.sidebar.priceBoard')}
          </Link>
        </Button>
      </div>

      {sampleCheck.isFlagged && !bannerDismissed && (
        <div
          role="alert"
          data-testid="sample-data-banner"
          className="bg-turmeric-light border-turmeric text-turmeric-foreground flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-3.5 text-xs sm:text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="font-bold">{t('staff.dashboard.sampleDataFlagged')}</p>
              <p className="opacity-90">{t('staff.dashboard.sampleBannerExplain')}</p>
              <ul className="list-disc pl-4 opacity-90">
                {sampleCheck.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/staff/pricing" className="text-turmeric-foreground font-bold underline">
              {t('staff.dashboard.reviewPrices')}
            </Link>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label={t('common.close')}
              className="touch-target inline-flex items-center justify-center rounded-md"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t('staff.dashboard.totalSales')}
          value={formatMoney(r.totalSales)}
          hint={`${r.totalBills} ${t('staff.dashboard.totalBills').toLowerCase()} · ${t('staff.dashboard.avgBill')}: ${formatMoney(r.averageBill)}`}
          tone="positive"
          icon={<TrendingUp className="size-5" />}
        />
        <Stat
          label={t('staff.dashboard.ordersWaiting', { defaultValue: 'Orders waiting' })}
          value={ordersStats.waiting}
          hint={`${ordersStats.total} ${t('common.all').toLowerCase()} · ${ordersStats.completed} ${t('orders.status.DELIVERED').toLowerCase()}`}
          tone={ordersStats.waiting > 0 ? 'warning' : 'neutral'}
          icon={<Package className="size-5" />}
        />
        <Stat
          label={t('staff.dashboard.purchasesSpend')}
          value={formatMoney(r.purchaseSpend)}
          hint={t('staff.dashboard.noPurchaseNote')}
          tone="danger"
          icon={<ShoppingBag className="size-5" />}
        />
        <Stat
          label={t('staff.dashboard.cashHeld', { defaultValue: 'Cash held' })}
          value={formatMoney(cashHeldTotal)}
          hint={`${t('staff.dashboard.avgBill')}: ${formatMoney(r.averageBill)}`}
          tone={cashHeldTotal.gt(0) ? 'warning' : 'neutral'}
          icon={<Banknote className="size-5" />}
        />
      </div>

      {/* Charts right in core view for immediate visual telemetry */}
      <DashboardCharts report={r} catalogById={catalogById} />

      {/* Phase 3: Inventory Intelligence, Stock Movements, Profitability & Freshness Batches */}
      <BusinessIntelligencePanel />

      <DashboardRecentActivity
        orders={staffOrders.data ?? []}
        purchases={recentPurchases.data ?? []}
      />

      <DashboardOperationalCards
        outOfStockItems={outOfStockItems}
        lowStockItems={lowStockItems}
        cashHeldTotal={cashHeldTotal}
        missingPhotosCount={missingPhotosCount}
        totalPhotoTargets={photoTargets.length}
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <NeedsAttentionCard items={attentionItems} />
        <div className="no-print space-y-4">
          <LaunchChecklist />
          <OperationalHealthCard />
        </div>
      </div>

      <span className="sr-only">
        <BarChart3 />
      </span>
    </div>
  )
}
