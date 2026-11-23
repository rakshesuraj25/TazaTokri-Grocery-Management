import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  QrCode,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dec, formatMoney, toApiMoney } from '@/lib/money'
import { toApiError } from '@/lib/api'
import {
  useIssueDeliveryOtp,
  useMarkDelivered,
  useMarkFailed,
  useVerifyDeliveryOtp,
} from '../hooks'
import type { DeliveryOrder, OtpIssueResponse } from '../types'

interface DeliverOrderDialogProps {
  order: DeliveryOrder | null
  onClose: () => void
}

const RECIPIENT_PRESETS = ['Customer', 'Family member', 'Neighbor / Security'] as const

export function DeliverOrderDialog({ order, onClose }: DeliverOrderDialogProps) {
  const { t } = useTranslation()
  const markDelivered = useMarkDelivered()
  const issueOtp = useIssueDeliveryOtp()
  const verifyOtp = useVerifyDeliveryOtp()

  const [recipientName, setRecipientName] = useState('Customer')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [collectMethod, setCollectMethod] = useState<'CASH' | 'UPI_QR'>('CASH')
  const [upiRef, setUpiRef] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)

  // Optional OTP state (collapsed by default for real-world speed)
  const [showOtpSection, setShowOtpSection] = useState(false)
  const [otpVerifiedLocal, setOtpVerifiedLocal] = useState(false)
  const [otpIssuedInfo, setOtpIssuedInfo] = useState<OtpIssueResponse | null>(null)
  const [otpInput, setOtpInput] = useState('')

  useEffect(() => {
    setRecipientName('Customer')
    setDeliveryNote('')
    setCollectMethod('CASH')
    setUpiRef('')
    setDialogError(null)
    setShowOtpSection(false)
    setOtpVerifiedLocal(Boolean(order?.otpVerified))
    setOtpIssuedInfo(null)
    setOtpInput('')
  }, [order])

  const isVerified = Boolean(order?.otpVerified) || otpVerifiedLocal

  const handleIssueOtp = () => {
    if (!order) return
    setDialogError(null)
    issueOtp.mutate(order.orderId, {
      onSuccess: (res) => {
        setOtpIssuedInfo(res)
        toast.success(res.message)
      },
      onError: (err) => setDialogError(toApiError(err).message),
    })
  }

  const handleVerifyOtp = () => {
    if (!order) return
    const cleaned = otpInput.trim()
    if (!/^[0-9]{6}$/.test(cleaned)) {
      setDialogError(
        t('delivery.otpSixDigitsRequired', {
          defaultValue: 'Enter the 6-digit delivery OTP shared by the customer.',
        }),
      )
      return
    }
    setDialogError(null)
    verifyOtp.mutate(
      { orderId: order.orderId, otp: cleaned },
      {
        onSuccess: (res) => {
          setOtpVerifiedLocal(true)
          toast.success(res.message)
        },
        onError: (err) => setDialogError(toApiError(err).message),
      },
    )
  }

  const handleConfirm = () => {
    if (!order) return
    setDialogError(null)

    const cleanRecipient = recipientName.trim()
    if (!isVerified && cleanRecipient.length < 2) {
      setDialogError('Enter who received the order (e.g. Customer or Family member).')
      return
    }

    const needsCollection = dec(order.amountToCollect).gt(0)
    if (needsCollection && collectMethod === 'UPI_QR' && upiRef.trim().length < 4) {
      setDialogError(
        t('delivery.upiReferenceRequired', {
          defaultValue: 'Enter the UPI transaction reference (at least 4 characters).',
        }),
      )
      return
    }

    markDelivered.mutate(
      {
        orderId: order.orderId,
        body: {
          ...(needsCollection
            ? {
                method: collectMethod,
                amountCollected: toApiMoney(order.amountToCollect),
                reference: collectMethod === 'UPI_QR' ? upiRef.trim() : undefined,
              }
            : {}),
          recipientName: cleanRecipient || 'Customer',
          deliveryNote: deliveryNote.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('delivery.deliveredSuccess'))
          onClose()
        },
        onError: (err) => setDialogError(toApiError(err).message),
      },
    )
  }

  return (
    <Sheet open={Boolean(order)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl"
      >
        {order && (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>
                Mark Delivered — #{order.orderId}
              </SheetTitle>
            </SheetHeader>

            {dialogError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {dialogError}
              </p>
            )}

            {/* 1. Who received the order? */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-bold">
                <UserCheck className="text-primary size-4" aria-hidden />
                Who received the order?
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {RECIPIENT_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={recipientName === preset ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => setRecipientName(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <Input
                aria-label="Recipient name"
                placeholder="Recipient name (e.g. Customer, Mother, Guard)"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
              <Input
                aria-label="Delivery note (optional)"
                placeholder="Optional note (e.g. Left at gate)"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
              />
            </div>

            {/* 2. COD Collection or Prepaid Banner */}
            {dec(order.amountToCollect).gt(0) ? (
              <div className="space-y-3 rounded-xl border p-3.5">
                <div className="bg-turmeric-light text-turmeric-foreground flex items-center justify-between rounded-xl px-3.5 py-2.5">
                  <span className="text-sm font-semibold">Amount to Collect</span>
                  <span className="font-display text-xl font-extrabold">
                    {formatMoney(order.amountToCollect)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="lg"
                    variant={collectMethod === 'CASH' ? 'default' : 'outline'}
                    onClick={() => setCollectMethod('CASH')}
                  >
                    <Banknote className="size-4" />
                    Cash
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant={collectMethod === 'UPI_QR' ? 'default' : 'outline'}
                    onClick={() => setCollectMethod('UPI_QR')}
                  >
                    <QrCode className="size-4" />
                    UPI
                  </Button>
                </div>

                {collectMethod === 'UPI_QR' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="del-ref">{t('delivery.upiReference')}</Label>
                    <Input
                      id="del-ref"
                      value={upiRef}
                      onChange={(e) => setUpiRef(e.target.value)}
                      placeholder="UTR / Transaction ID"
                      required
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-secondary/70 flex items-center gap-2 rounded-xl p-3 text-sm font-semibold">
                <CheckCircle2 className="text-primary size-5 shrink-0" aria-hidden />
                <span>{t('delivery.prepaidCollectNothing', { defaultValue: 'Prepaid, collect nothing' })}</span>
              </div>
            )}

            {/* 3. Optional OTP Verification (non-blocking) */}
            <div data-testid="delivery-otp-section" className="border-border rounded-xl border p-3 text-xs">
              <button
                type="button"
                onClick={() => setShowOtpSection((v) => !v)}
                className="flex w-full items-center justify-between font-semibold"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="text-primary size-4" aria-hidden />
                  Customer OTP (Optional)
                  {isVerified && (
                    <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]">
                      <ShieldCheck className="size-3" /> Verified
                    </span>
                  )}
                </span>
                {showOtpSection ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>

              {showOtpSection && !isVerified && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={issueOtp.isPending}
                      onClick={handleIssueOtp}
                    >
                      Send 6-Digit OTP
                    </Button>
                    {otpIssuedInfo && (
                      <span className="text-muted-foreground text-[11px]">
                        {otpIssuedInfo.maskedCustomerPhone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="6-digit delivery OTP"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit OTP"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      className="h-9 font-mono text-sm tracking-widest"
                    />
                    <Button
                      type="button"
                      size="sm"
                      loading={verifyOtp.isPending}
                      onClick={handleVerifyOtp}
                    >
                      Verify OTP
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" size="lg" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button size="lg" loading={markDelivered.isPending} onClick={handleConfirm}>
                Mark Delivered
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

interface FailOrderDialogProps {
  order: DeliveryOrder | null
  onClose: () => void
}

const FAIL_REASONS = [
  'Customer not at home',
  'Phone not reachable',
  'Address not found',
  'Customer refused',
  'Other',
] as const

export function FailOrderDialog({ order, onClose }: FailOrderDialogProps) {
  const { t } = useTranslation()
  const markFailed = useMarkFailed()
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedReason('')
    setNote('')
    setDialogError(null)
  }, [order])

  const finalReason =
    selectedReason === 'Other'
      ? note.trim() || 'Other'
      : note.trim()
        ? `${selectedReason} — ${note.trim()}`
        : selectedReason

  const handleConfirm = () => {
    if (!order || !selectedReason) return
    if (selectedReason === 'Other' && note.trim().length < 2) {
      setDialogError('Please enter a short note describing the reason.')
      return
    }
    setDialogError(null)
    markFailed.mutate(
      { orderId: order.orderId, reason: finalReason },
      {
        onSuccess: () => {
          toast.info('Marked as unable to deliver')
          onClose()
        },
        onError: (err) => setDialogError(toApiError(err).message),
      },
    )
  }

  return (
    <Sheet open={Boolean(order)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl">
        {order && (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>Unable to Deliver — #{order.orderId}</SheetTitle>
            </SheetHeader>

            {dialogError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {dialogError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {FAIL_REASONS.map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={selectedReason === r ? 'destructive' : 'outline'}
                  className="rounded-full"
                  onClick={() => setSelectedReason(r)}
                >
                  {r}
                </Button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fail-note">Note (optional)</Label>
              <Input
                id="fail-note"
                placeholder="Any helpful details..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" size="lg" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                disabled={!selectedReason}
                loading={markFailed.isPending}
                onClick={handleConfirm}
              >
                Unable to Deliver
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
