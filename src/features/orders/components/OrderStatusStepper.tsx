import { useTranslation } from 'react-i18next'
import { Check, Clock, XCircle } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import type { OrderStatus } from '../types'

const HAPPY_STEPS: OrderStatus[] = [
  'PLACED',
  'CONFIRMED',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()

  if (status === 'CANCELLED') {
    return (
      <div
        data-testid="order-stepper-cancelled"
        className="bg-tomato-light text-tomato flex items-center justify-between gap-3 rounded-xl border border-red-200/70 p-3.5"
      >
        <div className="flex items-center gap-2.5 text-sm font-semibold">
          <XCircle className="size-5 shrink-0" aria-hidden />
          <span>{t('orders.status.CANCELLED')}</span>
        </div>
        <StatusBadge kind="order" status="CANCELLED" />
      </div>
    )
  }

  const activeIdx = HAPPY_STEPS.indexOf(status)

  return (
    <div className="space-y-3" data-testid="order-status-stepper">
      {status === 'PENDING_PAYMENT' && (
        <div className="bg-turmeric-light text-turmeric-foreground flex items-center gap-2 rounded-xl border border-amber-300/60 p-3 text-xs font-semibold">
          <Clock className="size-4 shrink-0" aria-hidden />
          <span>{t('orders.status.PENDING_PAYMENT')}</span>
        </div>
      )}

      <ol className="grid grid-cols-5 gap-1.5">
        {HAPPY_STEPS.map((step, idx) => {
          const completed = activeIdx >= idx
          const current = activeIdx === idx
          return (
            <li key={step} className="flex flex-col items-center text-center">
              <div
                className={`flex size-7 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                  completed
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border'
                } ${current ? 'ring-primary/25 ring-4' : ''}`}
              >
                {completed ? <Check className="size-3.5" aria-hidden /> : idx + 1}
              </div>
              <span
                className={`mt-1.5 text-[11px] leading-tight ${
                  completed ? 'text-foreground font-semibold' : 'text-muted-foreground'
                }`}
              >
                {t(`orders.status.${step}`, { defaultValue: step })}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
