import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Banknote,
  Camera,
  CheckCircle2,
  KeyRound,
  QrCode,
  ShieldCheck,
  Upload,
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
  useManualOtpOverride,
  useMarkDelivered,
  useMarkFailed,
  useUploadDeliveryProof,
  useVerifyDeliveryOtp,
} from '../hooks'
import type { DeliveryOrder, OtpIssueResponse } from '../types'

interface DeliverOrderDialogProps {
  order: DeliveryOrder | null
  onClose: () => void
}

export function DeliverOrderDialog({ order, onClose }: DeliverOrderDialogProps) {
  const { t } = useTranslation()
  const markDelivered = useMarkDelivered()
  const issueOtp = useIssueDeliveryOtp()
  const verifyOtp = useVerifyDeliveryOtp()
  const manualOverride = useManualOtpOverride()
  const uploadProof = useUploadDeliveryProof()

  const [collectMethod, setCollectMethod] = useState<'CASH' | 'UPI_QR'>('CASH')
  const [upiRef, setUpiRef] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)

  // OTP state
  const [otpVerifiedLocal, setOtpVerifiedLocal] = useState(false)
  const [otpIssuedInfo, setOtpIssuedInfo] = useState<OtpIssueResponse | null>(null)
  const [otpInput, setOtpInput] = useState('')
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  // Proof of Delivery photo state
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofNote, setProofNote] = useState('')
  const [proofUploadedLocal, setProofUploadedLocal] = useState(false)

  useEffect(() => {
    setCollectMethod('CASH')
    setUpiRef('')
    setDialogError(null)
    setOtpVerifiedLocal(Boolean(order?.otpVerified))
    setOtpIssuedInfo(null)
    setOtpInput('')
    setShowOverrideForm(false)
    setOverrideReason('')
    setProofFile(null)
    setProofNote('')
    setProofUploadedLocal(Boolean(order?.hasProofPhoto))
  }, [order])

  const isVerified = Boolean(order?.otpVerified) || otpVerifiedLocal
  const hasPhoto = Boolean(order?.hasProofPhoto) || proofUploadedLocal

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

  const handleManualOverride = () => {
    if (!order) return
    if (overrideReason.trim().length < 10) {
      setDialogError(
        t('delivery.overrideReasonMinLength', {
          defaultValue:
            'Provide a detailed reason (at least 10 characters) for the audit log.',
        }),
      )
      return
    }
    setDialogError(null)
    manualOverride.mutate(
      { orderId: order.orderId, reason: overrideReason.trim() },
      {
        onSuccess: (res) => {
          setOtpVerifiedLocal(true)
          setShowOverrideForm(false)
          toast.success(res.message)
        },
        onError: (err) => setDialogError(toApiError(err).message),
      },
    )
  }

  const handleUploadProof = () => {
    if (!order || !proofFile) return
    setDialogError(null)
    uploadProof.mutate(
      { orderId: order.orderId, file: proofFile, note: proofNote },
      {
        onSuccess: () => {
          setProofUploadedLocal(true)
          setProofFile(null)
          toast.success(
            t('delivery.proofUploadSuccess', {
              defaultValue: 'Proof of delivery photo uploaded securely.',
            }),
          )
        },
        onError: (err) => setDialogError(toApiError(err).message),
      },
    )
  }

  const handleConfirm = () => {
    if (!order) return
    setDialogError(null)
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
        body: needsCollection
          ? {
              method: collectMethod,
              amountCollected: toApiMoney(order.amountToCollect),
              reference: collectMethod === 'UPI_QR' ? upiRef.trim() : undefined,
            }
          : undefined,
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
                {t('delivery.deliver')} — #{order.orderId}
              </SheetTitle>
            </SheetHeader>

            {dialogError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {dialogError}
              </p>
            )}

            {/* Step 1: Delivery OTP Verification */}
            <div
              data-testid="delivery-otp-section"
              className="border-border bg-surface-subtle space-y-2.5 rounded-xl border p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display flex items-center gap-1.5 text-sm font-bold">
                  <KeyRound className="text-primary size-4" aria-hidden />
                  {t('delivery.otpVerificationTitle', {
                    defaultValue: '1. Customer OTP Verification',
                  })}
                </span>
                {isVerified && (
                  <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    {t('delivery.verifiedLabel', { defaultValue: 'Verified' })}
                  </span>
                )}
              </div>

              {!isVerified ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={issueOtp.isPending}
                      onClick={handleIssueOtp}
                    >
                      {t('delivery.issueOtpBtn', {
                        defaultValue: 'Send / Issue 6-Digit OTP',
                      })}
                    </Button>
                    {otpIssuedInfo && (
                      <span className="text-muted-foreground text-[11px]">
                        {otpIssuedInfo.maskedCustomerPhone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={t('delivery.enterOtpLabel', {
                        defaultValue: '6-digit delivery OTP',
                      })}
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
                      {t('delivery.verifyOtpBtn', { defaultValue: 'Verify OTP' })}
                    </Button>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowOverrideForm((v) => !v)}
                      className="text-muted-foreground hover:text-foreground text-[11px] font-medium underline"
                    >
                      {t('delivery.manualExceptionToggle', {
                        defaultValue:
                          'Customer has no network / phone unreachable? Use audited exception',
                      })}
                    </button>

                    {showOverrideForm && (
                      <div className="border-turmeric bg-turmeric-light/30 mt-2 space-y-2 rounded-lg border p-2.5">
                        <p className="text-turmeric-foreground flex items-center gap-1 text-[11px] font-semibold">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          {t('delivery.manualExceptionAuditNote', {
                            defaultValue:
                              'Manual override is logged in the security audit trail with your staff ID.',
                          })}
                        </p>
                        <Input
                          aria-label={t('delivery.overrideReasonLabel', {
                            defaultValue: 'Mandatory override reason',
                          })}
                          placeholder="Reason (e.g. Customer phone off, verified ID at doorstep)"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          loading={manualOverride.isPending}
                          onClick={handleManualOverride}
                        >
                          {t('delivery.confirmOverrideBtn', {
                            defaultValue: 'Record Audited Manual Verification',
                          })}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {t('delivery.otpVerifiedReadyNote', {
                    defaultValue:
                      'Customer verification recorded. You can now complete payment collection and delivery.',
                  })}
                </p>
              )}
            </div>

            {/* Step 2: Optional Proof of Delivery Photo */}
            <div
              data-testid="delivery-pod-section"
              className="border-border bg-surface-subtle space-y-2 rounded-xl border p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display flex items-center gap-1.5 text-sm font-bold">
                  <Camera className="text-primary size-4" aria-hidden />
                  {t('delivery.podSectionTitle', {
                    defaultValue: '2. Proof of Delivery Photo (Optional)',
                  })}
                </span>
                {hasPhoto && (
                  <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    {t('delivery.photoSavedBadge', { defaultValue: 'Uploaded' })}
                  </span>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  aria-label={t('delivery.podFileInputLabel', {
                    defaultValue: 'Proof of delivery photo',
                  })}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!proofFile}
                  loading={uploadProof.isPending}
                  onClick={handleUploadProof}
                >
                  <Upload className="size-3.5" aria-hidden />
                  {t('delivery.uploadProofBtn', { defaultValue: 'Upload Photo' })}
                </Button>
              </div>
              <Input
                placeholder={t('delivery.podNotePlaceholder', {
                  defaultValue: 'Optional delivery note (e.g. Handed to customer at gate)',
                })}
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Step 3: Payment Collection */}
            {dec(order.amountToCollect).gt(0) ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  {(['CASH', 'UPI_QR'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={collectMethod === m}
                      onClick={() => setCollectMethod(m)}
                      className={`touch-target flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold ${
                        collectMethod === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card'
                      }`}
                    >
                      {m === 'CASH' ? (
                        <Banknote className="size-4" />
                      ) : (
                        <QrCode className="size-4" />
                      )}
                      {m === 'CASH' ? t('delivery.cash') : t('delivery.upiQr')}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="del-amt">{t('delivery.amountCollected')}</Label>
                  <Input
                    id="del-amt"
                    type="text"
                    readOnly
                    value={formatMoney(order.amountToCollect)}
                    aria-readonly="true"
                    className="bg-muted font-display text-lg font-bold"
                  />
                  <p className="text-muted-foreground text-xs">
                    {t('delivery.exactAmountNote', {
                      defaultValue: 'Exact bill amount must be collected in full.',
                    })}
                  </p>
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
                <span>{t('delivery.prepaidCollectNothing')}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" size="lg" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button size="lg" loading={markDelivered.isPending} onClick={handleConfirm}>
                {t('delivery.deliver')}
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

export function FailOrderDialog({ order, onClose }: FailOrderDialogProps) {
  const { t } = useTranslation()
  const markFailed = useMarkFailed()
  const [reason, setReason] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)

  const quickReasons = [
    t('delivery.failCustomerUnavailable', { defaultValue: 'Customer unavailable' }),
    t('delivery.failWrongAddress', { defaultValue: 'Wrong or incomplete address' }),
    t('delivery.failRefused', { defaultValue: 'Customer refused delivery' }),
    t('delivery.failPhoneUnreachable', { defaultValue: 'Phone unreachable' }),
  ]

  useEffect(() => {
    setReason('')
    setDialogError(null)
  }, [order])

  const handleConfirm = () => {
    if (!order || reason.trim().length < 2) return
    setDialogError(null)
    markFailed.mutate(
      { orderId: order.orderId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.info(t('delivery.fail'))
          setReason('')
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
              <SheetTitle>
                {t('delivery.fail')} — #{order.orderId}
              </SheetTitle>
            </SheetHeader>

            {dialogError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {dialogError}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={reason === r ? 'destructive' : 'outline'}
                  onClick={() => setReason(r)}
                >
                  {r}
                </Button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fail-reason">{t('delivery.failReason')}</Label>
              <Input
                id="fail-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" size="lg" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                disabled={reason.trim().length < 2}
                loading={markFailed.isPending}
                onClick={handleConfirm}
              >
                {t('delivery.fail')}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
