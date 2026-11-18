import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ONLINE_ORDER_EXPIRY_MINUTES } from '@/lib/businessRules'
import { fmtCountdown } from '@/lib/dates'

interface PendingPaymentCardProps {
  createdAt: string
  loading: boolean
  onPayNow: () => void
}

function computeRemainingSeconds(createdAt: string): number {
  const createdMs = Date.parse(createdAt)
  if (!Number.isFinite(createdMs)) return ONLINE_ORDER_EXPIRY_MINUTES * 60
  const expiresAt = createdMs + ONLINE_ORDER_EXPIRY_MINUTES * 60 * 1000
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
}

export function PendingPaymentCard({
  createdAt,
  loading,
  onPayNow,
}: PendingPaymentCardProps) {
  const { t } = useTranslation()
  const [remainingSec, setRemainingSec] = useState(() => computeRemainingSeconds(createdAt))

  useEffect(() => {
    setRemainingSec(computeRemainingSeconds(createdAt))
    const timer = window.setInterval(() => {
      setRemainingSec(computeRemainingSeconds(createdAt))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [createdAt])

  return (
    <Card className="bg-turmeric-light/65 border-amber-300/60 flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="space-y-0.5">
        <p className="text-turmeric-foreground text-sm font-semibold">
          {t('checkout.pendingPayment')}
        </p>
        <p className="text-turmeric-foreground/90 money-num flex items-center gap-1.5 text-xs font-medium">
          <Timer className="size-3.5 shrink-0" aria-hidden />
          {t('checkout.paymentExpires', { time: fmtCountdown(remainingSec) })}
        </p>
      </div>
      <Button loading={loading} disabled={remainingSec <= 0} onClick={onPayNow}>
        <CreditCard className="size-4" aria-hidden />
        {t('checkout.payNow')}
      </Button>
    </Card>
  )
}
