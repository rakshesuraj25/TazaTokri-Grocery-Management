import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  Calculator,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  Smartphone,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { toApiError } from '@/lib/api'
import { fmtDate, fmtTime, todayIST } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import {
  useCashClosingHistory,
  useCloseCashDay,
  useDailyCashTally,
} from '../cashClosingApi'

export default function CashClosingPage() {
  const today = todayIST()
  const [businessDate, setBusinessDate] = useState(today)
  const tallyQuery = useDailyCashTally(businessDate)
  const historyQuery = useCashClosingHistory()
  const closeMutation = useCloseCashDay()

  const [openingCash, setOpeningCash] = useState('0')
  const [cashExpenses, setCashExpenses] = useState('0')
  const [expenseNote, setExpenseNote] = useState('')
  const [actualCounted, setActualCounted] = useState('')
  const [closingNote, setClosingNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    const data = tallyQuery.data
    if (!data) return
    setFormError(null)
    if (data.status === 'CLOSED') {
      setOpeningCash(String(data.openingCash))
      setCashExpenses(String(data.cashExpenses))
      setExpenseNote(data.expenseNote ?? '')
      setActualCounted(data.actualCashCounted !== null ? String(data.actualCashCounted) : '')
      setClosingNote(data.note ?? '')
    } else {
      setOpeningCash(String(data.suggestedOpeningCash ?? 0))
      setCashExpenses('0')
      setExpenseNote('')
      setActualCounted('')
      setClosingNote('')
    }
  }, [tallyQuery.data])

  const tally = tallyQuery.data

  const liveCalc = useMemo(() => {
    if (!tally) return null
    const opening = tally.status === 'CLOSED' ? tally.openingCash : Number(openingCash)
    const expenses = tally.status === 'CLOSED' ? tally.cashExpenses : Number(cashExpenses)
    const validInputs =
      Number.isFinite(opening) && opening >= 0 && Number.isFinite(expenses) && expenses >= 0
    const expected =
      tally.status === 'CLOSED'
        ? tally.expectedCash
        : validInputs
          ? Number(
              (
                opening +
                tally.shopCashSales +
                tally.codCashSettledToShop -
                expenses -
                tally.cashRefunds
              ).toFixed(2),
            )
          : tally.expectedCash

    const countedNum =
      tally.status === 'CLOSED'
        ? tally.actualCashCounted
        : actualCounted.trim() === ''
          ? null
          : Number(actualCounted)
    const diff =
      tally.status === 'CLOSED'
        ? tally.difference
        : countedNum !== null && Number.isFinite(countedNum) && countedNum >= 0
          ? Number((countedNum - expected).toFixed(2))
          : null

    const digitalTotal = Number(
      (tally.posUpiSales + tally.deliveryUpiCollections + tally.razorpayCollections).toFixed(2),
    )

    return { expected, countedNum, diff, digitalTotal }
  }, [tally, openingCash, cashExpenses, actualCounted])

  const handleCloseDay = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tally || tally.status === 'CLOSED' || closeMutation.isPending || submittingRef.current) {
      return
    }
    setFormError(null)

    const opening = Number(openingCash)
    const expenses = Number(cashExpenses || 0)
    const counted = actualCounted.trim() === '' ? Number.NaN : Number(actualCounted)

    if (!Number.isFinite(opening) || opening < 0) {
      setFormError('Opening cash must be 0 or greater.')
      return
    }
    if (!Number.isFinite(expenses) || expenses < 0) {
      setFormError('Cash drawer expenses must be 0 or greater.')
      return
    }
    if (!Number.isFinite(counted) || counted < 0) {
      setFormError('Enter the actual physical cash counted (0 or greater).')
      return
    }

    submittingRef.current = true
    closeMutation.mutate(
      {
        date: businessDate,
        openingCash: opening,
        cashExpenses: expenses,
        expenseNote: expenseNote.trim() || undefined,
        actualCashCounted: counted,
        note: closingNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          submittingRef.current = false
          toast.success(`Daily cash closing completed for ${fmtDate(businessDate)}`)
        },
        onError: (err) => {
          submittingRef.current = false
          setFormError(toApiError(err).message)
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title="Daily Cash Tally & Closing"
        breadcrumbs={[{ label: 'Money' }, { label: 'Cash Closing' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="closing-date" className="text-xs font-semibold">
              Business date
            </Label>
            <Input
              id="closing-date"
              type="date"
              max={today}
              value={businessDate}
              onChange={(e) => {
                if (e.target.value) setBusinessDate(e.target.value)
              }}
              className="w-auto"
            />
            {tally && (
              <Badge variant={tally.status === 'CLOSED' ? 'success' : 'warning'}>
                {tally.status === 'CLOSED' ? 'Closed' : 'Open'}
              </Badge>
            )}
          </div>
        }
      />

      {tallyQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : tallyQuery.isError || !tally || !liveCalc ? (
        <ErrorState onRetry={() => void tallyQuery.refetch()} />
      ) : (
        <>
          {!tally.hasTransactions && (
            <EmptyState
              icon={<Calculator className="size-7" aria-hidden />}
              title={`No transactions recorded for ${fmtDate(tally.date)}`}
              description="Shop POS sales, delivery collections, and purchases for this date will appear here. You can still complete a zero-balance closing if the shop was closed."
            />
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Expected Drawer Cash"
              value={formatMoney(liveCalc.expected)}
              icon={<Banknote className="size-5" />}
              tone="positive"
            />
            <Stat
              label="Shop Cash Sales (POS)"
              value={formatMoney(tally.shopCashSales)}
              hint={`${tally.shopCashBills} bill(s)`}
              icon={<Calculator className="size-5" />}
            />
            <Stat
              label="COD Settled to Shop"
              value={formatMoney(tally.codCashSettledToShop)}
              hint={`Pending riders: ${formatMoney(tally.codCashPendingSettlement)}`}
              icon={<Truck className="size-5" />}
              tone={tally.codCashPendingSettlement > 0 ? 'warning' : 'neutral'}
            />
            <Stat
              label="Digital / UPI Total"
              value={formatMoney(liveCalc.digitalTotal)}
              hint="Not in cash drawer"
              icon={<Smartphone className="size-5" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            {/* Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cash & Collection Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2 rounded-xl border p-3.5">
                  <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    Shop Cash Drawer Flow
                  </p>
                  <div className="flex justify-between">
                    <span>Opening cash balance</span>
                    <MoneyDisplay value={tally.status === 'CLOSED' ? tally.openingCash : Number(openingCash || 0)} />
                  </div>
                  <div className="flex justify-between">
                    <span>+ Cash sales at shop (POS)</span>
                    <MoneyDisplay value={tally.shopCashSales} />
                  </div>
                  <div className="flex justify-between">
                    <span>+ Delivery COD cash settled to shop</span>
                    <MoneyDisplay value={tally.codCashSettledToShop} />
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>− Cash drawer expenses</span>
                    <MoneyDisplay value={tally.status === 'CLOSED' ? tally.cashExpenses : Number(cashExpenses || 0)} />
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>− Cash refunds / payouts</span>
                    <MoneyDisplay value={tally.cashRefunds} />
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Expected cash in drawer</span>
                    <MoneyDisplay value={liveCalc.expected} className="text-primary text-base font-extrabold" />
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border p-3.5">
                  <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    COD Delivery Cash Status (Non-Double-Counted)
                  </p>
                  <div className="flex justify-between">
                    <span>COD cash collected by riders on {fmtDate(tally.date)}</span>
                    <MoneyDisplay value={tally.codCashCollected} />
                  </div>
                  <div className="flex justify-between">
                    <span>COD cash settled back to shop on {fmtDate(tally.date)}</span>
                    <MoneyDisplay value={tally.codCashSettledToShop} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Currently unsettled with delivery staff</span>
                    <div className="flex items-center gap-2">
                      <MoneyDisplay value={tally.codCashPendingSettlement} className="font-bold" />
                      {tally.codCashPendingSettlement > 0 && (
                        <Button asChild size="sm" variant="outline" className="h-7 rounded-full text-xs">
                          <Link to="/staff/payments">Settle</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border p-3.5">
                  <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    Digital Collections & Reference
                  </p>
                  <div className="flex justify-between">
                    <span>POS UPI collections ({tally.posUpiBills} bills)</span>
                    <MoneyDisplay value={tally.posUpiSales} />
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery UPI QR collections</span>
                    <MoneyDisplay value={tally.deliveryUpiCollections} />
                  </div>
                  <div className="flex justify-between">
                    <span>Online Razorpay collections</span>
                    <MoneyDisplay value={tally.razorpayCollections} />
                  </div>
                  {tally.digitalRefunds > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Razorpay refunds (digital)</span>
                      <MoneyDisplay value={tally.digitalRefunds} />
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-muted-foreground">
                    <span>Stock purchase spend on date (reference)</span>
                    <MoneyDisplay value={tally.purchaseSpend} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Count & Close */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {tally.status === 'CLOSED' ? (
                    <>
                      <Lock className="text-primary size-4" aria-hidden />
                      Closing Summary
                    </>
                  ) : (
                    <>
                      <CreditCard className="text-primary size-4" aria-hidden />
                      Count Drawer & Close Day
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tally.status === 'CLOSED' ? (
                  <div className="space-y-4">
                    <div className="bg-secondary/50 space-y-2 rounded-xl border p-4 text-sm">
                      <div className="flex items-center gap-2 font-bold text-primary">
                        <CheckCircle2 className="size-4" aria-hidden />
                        <span>Day closed for {fmtDate(tally.date)}</span>
                      </div>
                      {tally.closedAt && (
                        <p className="text-muted-foreground text-xs">
                          Closed by {tally.closedBy} on {fmtDate(tally.closedAt)} at {fmtTime(tally.closedAt)}
                        </p>
                      )}
                      <div className="space-y-1.5 border-t pt-2.5">
                        <div className="flex justify-between">
                          <span>Expected Cash</span>
                          <MoneyDisplay value={tally.expectedCash} />
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Actual Cash Counted</span>
                          <MoneyDisplay value={tally.actualCashCounted ?? 0} />
                        </div>
                        <DifferenceRow diff={tally.difference ?? 0} />
                      </div>
                      {tally.expenseNote && (
                        <p className="text-muted-foreground pt-1 text-xs">
                          Expense note: {tally.expenseNote}
                        </p>
                      )}
                      {tally.note && (
                        <p className="text-muted-foreground text-xs">Closing note: {tally.note}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCloseDay} noValidate className="space-y-4">
                    {formError && (
                      <div
                        role="alert"
                        className="bg-tomato-light text-tomato rounded-xl border border-red-200/70 p-3 text-sm font-medium"
                      >
                        {formError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="opening-cash">Opening cash (₹)</Label>
                        <Input
                          id="opening-cash"
                          type="number"
                          min="0"
                          step="0.01"
                          value={openingCash}
                          onChange={(e) => setOpeningCash(e.target.value)}
                        />
                        {tally.suggestedOpeningCash > 0 && (
                          <p className="text-muted-foreground text-[11px]">
                            Carried from previous closing: {formatMoney(tally.suggestedOpeningCash)}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="cash-expenses">Cash drawer expenses (₹)</Label>
                        <Input
                          id="cash-expenses"
                          type="number"
                          min="0"
                          step="0.01"
                          value={cashExpenses}
                          onChange={(e) => setCashExpenses(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="expense-note">Expense note (optional)</Label>
                      <Input
                        id="expense-note"
                        placeholder="e.g. Ice, carry bags, local transport"
                        value={expenseNote}
                        onChange={(e) => setExpenseNote(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="actual-counted">Actual physical cash counted (₹)</Label>
                      <Input
                        id="actual-counted"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Enter counted drawer cash"
                        value={actualCounted}
                        onChange={(e) => setActualCounted(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5 rounded-xl border p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expected Cash</span>
                        <MoneyDisplay value={liveCalc.expected} className="font-bold" />
                      </div>
                      {liveCalc.diff !== null && <DifferenceRow diff={liveCalc.diff} />}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="closing-note">Closing note (optional)</Label>
                      <Input
                        id="closing-note"
                        placeholder="Reason for short/excess or remarks"
                        value={closingNote}
                        onChange={(e) => setClosingNote(e.target.value)}
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      loading={closeMutation.isPending}
                      disabled={closeMutation.isPending}
                    >
                      Complete Daily Closing
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Closing History */}
          {historyQuery.data && historyQuery.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="text-primary size-4" aria-hidden />
                  Recent Daily Closings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Expected</th>
                        <th className="px-3 py-2">Counted</th>
                        <th className="px-3 py-2">Difference</th>
                        <th className="px-3 py-2">Closed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {historyQuery.data.map((row) => (
                        <tr key={row.date} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">
                            <button
                              type="button"
                              onClick={() => setBusinessDate(row.date)}
                              className="text-primary hover:underline"
                            >
                              {fmtDate(row.date)}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <MoneyDisplay value={row.expectedCash} />
                          </td>
                          <td className="px-3 py-2">
                            <MoneyDisplay value={row.actualCashCounted} />
                          </td>
                          <td className="px-3 py-2">
                            <DifferenceBadge diff={row.difference} />
                          </td>
                          <td className="text-muted-foreground px-3 py-2 text-xs">
                            {row.closedBy}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function DifferenceRow({ diff }: { diff: number }) {
  const isShort = diff < -0.005
  return (
    <div className="flex items-center justify-between border-t pt-2 font-bold">
      <span className="flex items-center gap-1.5">
        {isShort && <AlertTriangle className="text-destructive size-4" aria-hidden />}
        <span>Difference</span>
      </span>
      <DifferenceBadge diff={diff} />
    </div>
  )
}

function DifferenceBadge({ diff }: { diff: number }) {
  if (Math.abs(diff) < 0.005) {
    return <Badge variant="success">Matched (₹0.00)</Badge>
  }
  if (diff < 0) {
    return <Badge variant="destructive">Short {formatMoney(Math.abs(diff))}</Badge>
  }
  return <Badge variant="warning">Excess +{formatMoney(diff)}</Badge>
}
