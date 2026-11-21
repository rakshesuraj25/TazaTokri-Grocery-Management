import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, IndianRupee, MapPin, Phone, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { toApiError } from '@/lib/api'
import { fmtDate, todayIST } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useRecordSupplierPayment, useSupplierDetail, useUpdateSupplierStatus } from '../hooks'
import type { SupplierPaymentMethod } from '../types'

const paymentSchema = z.object({
  purchaseId: z.string().optional(),
  amount: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER']),
  paymentDate: z.string().min(1, 'Payment date is required'),
  referenceNumber: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
})
type PaymentFormValues = z.infer<typeof paymentSchema>

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const detail = useSupplierDetail(id)
  const recordPayment = useRecordSupplierPayment()
  const toggleStatus = useUpdateSupplierStatus()

  const [tab, setTab] = useState<'purchases' | 'payments'>('purchases')
  const [serverError, setServerError] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `pay-${Date.now()}-${Math.random()}`,
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      purchaseId: '',
      amount: '',
      paymentMethod: 'CASH',
      paymentDate: todayIST(),
      referenceNumber: '',
      notes: '',
    },
  })

  if (detail.isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-5 text-sm text-muted-foreground">
        Loading supplier details...
      </div>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="mx-auto max-w-6xl p-5">
        <ErrorState
          message={detail.error ? toApiError(detail.error).message : 'Supplier not found'}
          onRetry={() => detail.refetch()}
        />
      </div>
    )
  }

  const { summary, purchases, payments } = detail.data
  const unpaidPurchases = purchases.filter(
    (p) => p.status !== 'CANCELLED' && Number(p.outstandingAmount ?? p.totalCost) > 0,
  )

  async function onSubmitPayment(values: PaymentFormValues) {
    setServerError(null)
    const outstanding = Number(summary.outstandingPayable)
    if (Number(values.amount) > outstanding) {
      setServerError(`Amount exceeds outstanding payable (${formatMoney(outstanding)})`)
      return
    }
    try {
      await recordPayment.mutateAsync({
        supplierId: summary.id,
        body: {
          purchaseId: values.purchaseId ? Number(values.purchaseId) : null,
          amount: Number(values.amount).toFixed(2),
          paymentMethod: values.paymentMethod as SupplierPaymentMethod,
          paymentDate: values.paymentDate,
          referenceNumber: values.referenceNumber?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
          idempotencyKey,
        },
      })
      toast.success('Supplier payment recorded')
      reset({
        purchaseId: '',
        amount: '',
        paymentMethod: 'CASH',
        paymentDate: todayIST(),
        referenceNumber: '',
        notes: '',
      })
      setIdempotencyKey(
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `pay-${Date.now()}-${Math.random()}`,
      )
    } catch (err) {
      setServerError(toApiError(err).message)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title={summary.name}
        breadcrumbs={[
          { label: 'Buy' },
          { label: 'Suppliers', to: '/staff/suppliers' },
          { label: summary.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/staff/suppliers">
                <ArrowLeft className="size-4" /> Back
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={async () => {
                await toggleStatus.mutateAsync({ id: summary.id, active: !summary.active })
                toast.success(summary.active ? 'Supplier deactivated' : 'Supplier activated')
              }}
            >
              {summary.active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/staff/purchases/new">
                <ShoppingBag className="size-4" /> New Purchase
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="rounded-3xl border p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={summary.active ? 'default' : 'secondary'}>
            {summary.active ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant="outline">{summary.type.replace('_', ' ')}</Badge>
          {summary.phone && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Phone className="size-3.5" /> {summary.phone}
            </span>
          )}
          {summary.address && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3.5" /> {summary.address}
            </span>
          )}
          {summary.notes && <span className="text-muted-foreground">• {summary.notes}</span>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Purchase Count" value={summary.purchaseCount} />
        <Stat label="Total Purchases" value={formatMoney(summary.totalPurchases)} />
        <Stat label="Total Payments" value={formatMoney(summary.totalPayments)} />
        <Stat label="Outstanding Payable" value={formatMoney(summary.outstandingPayable)} />
        <Stat
          label="Last Purchase"
          value={summary.lastPurchaseDate ? fmtDate(summary.lastPurchaseDate) : '—'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_2fr]">
        {/* Record Payment Form */}
        <Card className="h-fit rounded-3xl border p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <IndianRupee className="size-4" /> Record Supplier Payment
          </h2>
          <form onSubmit={handleSubmit(onSubmitPayment)} className="space-y-3" noValidate>
            {serverError && (
              <p className="text-destructive text-sm font-medium" role="alert">
                {serverError}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="pay-purchase">Related Purchase (optional)</Label>
              <select
                id="pay-purchase"
                {...register('purchaseId')}
                className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
              >
                <option value="">General supplier payment</option>
                {unpaidPurchases.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    #{p.id} {p.invoiceNumber ? `(${p.invoiceNumber})` : ''} — Due{' '}
                    {formatMoney(p.outstandingAmount ?? p.totalCost)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-amount">Amount (₹) *</Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('amount')}
              />
              {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="pay-method">Method *</Label>
                <select
                  id="pay-method"
                  {...register('paymentMethod')}
                  className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-date">Date *</Label>
                <Input id="pay-date" type="date" {...register('paymentDate')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-ref">Reference Number</Label>
              <Input id="pay-ref" placeholder="UTR / Cheque / Receipt #" {...register('referenceNumber')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-notes">Notes</Label>
              <Input id="pay-notes" placeholder="Optional notes" {...register('notes')} />
            </div>
            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={recordPayment.isPending || Number(summary.outstandingPayable) <= 0}
            >
              {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </form>
        </Card>

        {/* History Tabs */}
        <div className="space-y-3">
          <div className="inline-flex rounded-full bg-muted p-1">
            <Button
              type="button"
              size="sm"
              variant={tab === 'purchases' ? 'default' : 'ghost'}
              className="rounded-full"
              onClick={() => setTab('purchases')}
            >
              Purchase History ({purchases.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === 'payments' ? 'default' : 'ghost'}
              className="rounded-full"
              onClick={() => setTab('payments')}
            >
              Payment Ledger ({payments.length})
            </Button>
          </div>

          {tab === 'purchases' ? (
            purchases.length === 0 ? (
              <EmptyState title="No purchases recorded" description="Purchases from this supplier appear here." />
            ) : (
              <div className="space-y-2.5">
                {purchases.map((p) => (
                  <Card key={p.id} className="rounded-3xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link to={`/staff/purchases/${p.id}`} className="font-bold hover:underline">
                          Purchase #{p.id} {p.invoiceNumber ? `• ${p.invoiceNumber}` : ''}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {fmtDate(p.purchaseDate)} • {p.items.length} item(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.status === 'CANCELLED' ? 'destructive' : 'outline'}>
                          {p.paymentStatus ?? p.status ?? 'COMPLETED'}
                        </Badge>
                        <span className="font-bold">{formatMoney(p.totalCost)}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          ) : payments.length === 0 ? (
            <EmptyState title="No payments recorded" description="Recorded supplier payments appear here." />
          ) : (
            <div className="space-y-2.5">
              {payments.map((pay) => (
                <Card key={pay.id} className="rounded-3xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold">
                        {formatMoney(pay.amount)} via {pay.paymentMethod.replace('_', ' ')}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {fmtDate(pay.paymentDate)}
                        {pay.purchaseId ? ` • Purchase #${pay.purchaseId}` : ' • General Payment'}
                        {pay.referenceNumber ? ` • Ref: ${pay.referenceNumber}` : ''}
                      </p>
                      {pay.notes && <p className="text-muted-foreground mt-1 text-xs">{pay.notes}</p>}
                    </div>
                    <Badge variant="outline">Recorded</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
