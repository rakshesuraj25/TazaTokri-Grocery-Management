import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/DataTable'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { StatusBadge } from '@/components/StatusBadge'
import { useStaffOrders } from '@/features/orders/hooks'
import { fmtDate, fmtTime, todayIST } from '@/lib/dates'
import { dec, formatMoney, sumMoney, toApiMoney } from '@/lib/money'
import { toApiError } from '@/lib/api'
import {
  useOrderPayments,
  usePendingCash,
  useProcessRefunds,
  useSettleCash,
} from '../hooks'
import type { PendingCashItem } from '../types'

export default function PaymentsPage() {
  const { t } = useTranslation()
  const pendingCash = usePendingCash()
  const todayOrders = useStaffOrders({ date: todayIST() })
  const settleCash = useSettleCash()
  const processRefunds = useProcessRefunds()

  const [settleTarget, setSettleTarget] = useState<PendingCashItem | null>(null)
  const [receivedAmount, setReceivedAmount] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [orderInput, setOrderInput] = useState('')
  const [lookupOrderId, setLookupOrderId] = useState<string>('')
  const orderPayments = useOrderPayments(lookupOrderId || undefined)

  const summary = useMemo(() => {
    const pendingList = pendingCash.data ?? []
    const orders = todayOrders.data ?? []
    const cashHeld = sumMoney(pendingList.map((p) => p.amount))

    const onlineOrders = orders.filter((o) => o.paymentMethod === 'ONLINE' && o.status !== 'CANCELLED')
    const codOrders = orders.filter((o) => o.paymentMethod === 'COD' && o.status !== 'CANCELLED')
    const onlineTotal = sumMoney(onlineOrders.map((o) => o.finalTotal ?? o.estimatedTotal))
    const codTotal = sumMoney(codOrders.map((o) => o.finalTotal ?? o.estimatedTotal))
    const attentionCount = orders.filter(
      (o) =>
        o.status === 'PENDING_PAYMENT' ||
        (o.status === 'CANCELLED' && o.paymentMethod === 'ONLINE'),
    ).length

    return {
      cashHeld,
      onlineCount: onlineOrders.length,
      onlineTotal,
      codCount: codOrders.length,
      codTotal,
      attentionCount,
    }
  }, [pendingCash.data, todayOrders.data])

  const openSettle = (item: PendingCashItem) => {
    setSettleTarget(item)
    setReceivedAmount(String(item.amount))
    setDialogError(null)
  }

  const handleConfirmSettle = () => {
    if (!settleTarget) return
    setDialogError(null)
    if (!dec(receivedAmount).eq(dec(settleTarget.amount))) {
      setDialogError(t('delivery.amountMismatch', { amount: settleTarget.amount }))
      return
    }

    settleCash.mutate(
      {
        deliveryUserId: settleTarget.deliveryUserId,
        receivedAmount: toApiMoney(receivedAmount),
      },
      {
        onSuccess: () => {
          toast.success(t('common.done'))
          setSettleTarget(null)
        },
        onError: (err) => setDialogError(toApiError(err).message),
      },
    )
  }

  const handleProcessRefunds = () => {
    processRefunds.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(
          t('staff.payments.refundProcessed', {
            count: res.refunded,
            defaultValue: 'Refunded: {{count}}',
          }),
        )
      },
      onError: (err) => toast.error(toApiError(err).message),
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title={t('nav.payments')}
        breadcrumbs={[
          { label: t('staff.groups.money') },
          { label: t('nav.payments') },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            loading={processRefunds.isPending}
            onClick={handleProcessRefunds}
            className="rounded-full"
          >
            <RefreshCw className="size-4" aria-hidden />
            {t('staff.payments.processRefunds', { defaultValue: 'Process Pending Refunds' })}
          </Button>
        }
      />

      {/* Real Payment Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t('staff.dashboard.cashHeld', { defaultValue: 'Cash held' })}
          value={formatMoney(summary.cashHeld)}
          tone={summary.cashHeld.gt(0) ? 'warning' : 'neutral'}
          icon={<Wallet className="size-5" />}
        />
        <Stat
          label={t('staff.payments.todayCod', { defaultValue: "Today's COD orders" })}
          value={formatMoney(summary.codTotal)}
          hint={t('staff.payments.codOrdersCount', { count: summary.codCount })}
          tone="positive"
          icon={<Banknote className="size-5" />}
        />
        <Stat
          label={t('staff.payments.todayOnline', { defaultValue: "Today's UPI / Online" })}
          value={formatMoney(summary.onlineTotal)}
          hint={`${summary.onlineCount} ${t('nav.ordersStaff').toLowerCase()}`}
          tone="positive"
          icon={<CreditCard className="size-5" />}
        />
        <Stat
          label={t('staff.payments.pendingAction', { defaultValue: 'Pending / Refunds' })}
          value={summary.attentionCount}
          tone={summary.attentionCount > 0 ? 'danger' : 'neutral'}
          icon={<AlertCircle className="size-5" />}
        />
      </div>

      {/* COD Cash Settlements */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-bold">
          {t('staff.payments.cashSettlements', { defaultValue: 'Delivery COD settlements' })}
        </h2>
        {pendingCash.isPending || pendingCash.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : pendingCash.isError ? (
          <ErrorState onRetry={() => void pendingCash.refetch()} />
        ) : (pendingCash.data ?? []).length === 0 ? (
          <EmptyState
            title={t('staff.payments.noPendingCash', {
              defaultValue: 'All COD cash settlements are up to date.',
            })}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(pendingCash.data ?? []).map((item) => (
              <Card
                key={String(item.deliveryUserId)}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-bold">{item.fullName}</h3>
                  <Badge variant="secondary">
                    {t('staff.payments.codOrdersCount', {
                      count: item.payments,
                      defaultValue: '{{count}} COD orders',
                    })}
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <MoneyDisplay
                    value={item.amount}
                    className="font-display text-primary text-xl font-extrabold"
                  />
                  <Button size="sm" onClick={() => openSettle(item)} className="rounded-full">
                    <Banknote className="size-4" aria-hidden />
                    {t('staff.payments.markReceived', { defaultValue: 'Mark received' })}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's Orders Payment Inspector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('staff.payments.todayOrdersTitle', { defaultValue: "Today's orders payment reference" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(todayOrders.data ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('orders.noOrders')}</p>
            ) : (
              <DataTable compact aria-label="Today's order payments">
                <thead className="bg-muted/50 text-left text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">{t('checkout.paymentMethod')}</th>
                    <th className="px-3 py-2">{t('common.status', { defaultValue: 'Status' })}</th>
                    <th className="px-3 py-2 text-right">{t('cart.estimatedTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(todayOrders.data ?? []).slice(0, 8).map((o) => (
                    <tr
                      key={String(o.id)}
                      className="hover:bg-muted/20 cursor-pointer"
                      onClick={() => {
                        setOrderInput(String(o.id))
                        setLookupOrderId(String(o.id))
                      }}
                    >
                      <td className="px-3 py-2 font-display font-bold text-primary">#{o.id}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{o.paymentMethod}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge kind="order" status={o.status} />
                      </td>
                      <td className="px-3 py-2 text-right font-bold">
                        <MoneyDisplay value={o.finalTotal ?? o.estimatedTotal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardContent>
        </Card>

        {/* Order Payment Lookup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('staff.payments.orderHistoryTitle', { defaultValue: 'Order payment history' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t('staff.payments.refundsListNote')}
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setLookupOrderId(orderInput.trim())
              }}
            >
              <Input
                type="number"
                min="1"
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                placeholder={t('staff.payments.orderIdPlaceholder', { defaultValue: 'Order ID' })}
                aria-label={t('staff.payments.orderIdPlaceholder', { defaultValue: 'Order ID' })}
              />
              <Button type="submit" variant="outline" className="rounded-full">
                <Search className="size-4" aria-hidden />
                {t('common.search')}
              </Button>
            </form>

            {lookupOrderId && orderPayments.isLoading && <div className="skeleton h-16 rounded-xl" />}
            {lookupOrderId && orderPayments.isError && (
              <ErrorState onRetry={() => void orderPayments.refetch()} />
            )}
            {lookupOrderId && orderPayments.data && orderPayments.data.length === 0 && (
              <p className="text-muted-foreground text-sm">{t('common.noData')}</p>
            )}
            {lookupOrderId && orderPayments.data && orderPayments.data.length > 0 && (
              <ul className="divide-y rounded-xl border text-sm">
                {orderPayments.data.map((p) => (
                  <li
                    key={String(p.id)}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{p.kind}</Badge>
                        <Badge variant="secondary">{p.method}</Badge>
                        <Badge
                          variant={
                            p.status === 'SUCCESS'
                              ? 'success'
                              : p.status === 'FAILED'
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {p.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {fmtDate(p.createdAt)} · {fmtTime(p.createdAt)}
                        {p.reference ? ` · Ref: ${p.reference}` : ''}
                      </p>
                    </div>
                    <MoneyDisplay value={p.amount} className="font-display font-bold" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(settleTarget)} onOpenChange={(o) => !o && setSettleTarget(null)}>
        <DialogContent>
          {settleTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{settleTarget.fullName}</DialogTitle>
              </DialogHeader>

              {dialogError && (
                <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                  {dialogError}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="settle-amt">{t('delivery.amountCollected')}</Label>
                <Input
                  id="settle-amt"
                  type="number"
                  step="0.01"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  {t('staff.payments.exactAmountHint', {
                    defaultValue: 'Enter the exact pending cash amount to settle.',
                  })}
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSettleTarget(null)}>
                  {t('common.cancel')}
                </Button>
                <Button loading={settleCash.isPending} onClick={handleConfirmSettle}>
                  <CheckCircle2 className="size-4" aria-hidden />
                  {t('common.confirm')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
