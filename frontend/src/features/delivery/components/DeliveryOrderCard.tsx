import { useTranslation } from 'react-i18next'
import {
  Camera,
  CheckCircle2,
  MapPin,
  MessageSquareText,
  Phone,
  Play,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { dec, formatQty } from '@/lib/money'
import type { DeliveryOrder } from '../types'

interface DeliveryOrderCardProps {
  order: DeliveryOrder
  startPending: boolean
  disabledOffline?: boolean
  onStart: (orderId: string | number) => void
  onDeliver: (order: DeliveryOrder) => void
  onFail: (order: DeliveryOrder) => void
}

export function DeliveryOrderCard({
  order,
  startPending,
  disabledOffline = false,
  onStart,
  onDeliver,
  onFail,
}: DeliveryOrderCardProps) {
  const { t } = useTranslation()
  const cleanPhone = (order.customerPhone ?? '').replace(/[^\d+]/g, '')
  const destination = [order.address, order.pincode].filter(Boolean).join(', ')
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination,
  )}`
  const hasDue = dec(order.amountToCollect).gt(0)

  return (
    <Card
      data-testid={`delivery-order-card-${order.orderId}`}
      className={`border-border space-y-3.5 rounded-2xl p-4 shadow-[var(--shadow-card)] ${
        order.deliveryStatus === 'OUT_FOR_DELIVERY'
          ? 'border-primary/60 bg-primary/[0.03] ring-1 ring-primary/15'
          : order.deliveryStatus === 'FAILED'
            ? 'border-destructive/40 bg-destructive/[0.02]'
            : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-extrabold">#{order.orderId}</h2>
            <Badge
              variant={
                order.deliveryStatus === 'DELIVERED'
                  ? 'success'
                  : order.deliveryStatus === 'FAILED'
                    ? 'destructive'
                    : order.deliveryStatus === 'OUT_FOR_DELIVERY'
                      ? 'warning'
                      : 'secondary'
              }
            >
              {t(`delivery.status.${order.deliveryStatus}`, {
                defaultValue: order.deliveryStatus,
              })}
            </Badge>
            <Badge variant="outline">{order.paymentMethod}</Badge>
            {order.otpVerified && (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="size-3" aria-hidden />
                {order.otpVerificationMethod === 'MANUAL_OVERRIDE'
                  ? t('delivery.manualVerifiedBadge', { defaultValue: 'Exception Verified' })
                  : t('delivery.otpVerifiedBadge', { defaultValue: 'OTP Verified' })}
              </Badge>
            )}
            {order.hasProofPhoto && (
              <Badge variant="secondary" className="gap-1">
                <Camera className="size-3" aria-hidden />
                {t('delivery.podUploadedBadge', { defaultValue: 'Photo Proof' })}
              </Badge>
            )}
          </div>
          <p className="mt-1 font-semibold">{order.customerName}</p>
          <p className="text-muted-foreground text-sm break-words">
            {order.address} — {order.pincode}
          </p>
          {order.deliveryInstructions && (
            <p className="bg-surface-subtle text-foreground mt-1.5 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium">
              <MessageSquareText className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{order.deliveryInstructions}</span>
            </p>
          )}
        </div>

        {hasDue ? (
          <div className="bg-turmeric-light text-turmeric-foreground shrink-0 rounded-2xl px-3 py-1.5 text-right">
            <span className="block text-sm font-semibold">
              {t('delivery.collectAmount')}
            </span>
            <MoneyDisplay
              value={order.amountToCollect}
              className="font-display text-lg font-extrabold"
            />
          </div>
        ) : (
          <Badge variant="success" className="shrink-0">
            {t('delivery.prepaidCollectNothing', {
              defaultValue: 'Prepaid, collect nothing',
            })}
          </Badge>
        )}
      </div>

      <ul className="border-border/70 grid gap-2.5 border-t pt-3 text-sm sm:grid-cols-2">
        {order.items.map((line, i) => (
          <li key={i} className="flex items-center gap-2.5 font-medium">
            <VegetableImage nameEn={line.vegetable} size="xs" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{line.vegetable}</p>
              <p className="text-muted-foreground">
                {formatQty(line.packedQuantity)} {line.unit}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        {cleanPhone ? (
          <Button asChild variant="outline" size="lg" className="rounded-2xl">
            <a href={`tel:${cleanPhone}`}>
              <Phone className="size-4" />
              {t('delivery.callCustomer')}
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="lg" className="rounded-2xl" disabled>
            <Phone className="size-4" />
            {t('delivery.noPhone', { defaultValue: 'No phone' })}
          </Button>
        )}
        <Button asChild variant="outline" size="lg" className="rounded-2xl">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            <MapPin className="size-4" />
            {t('delivery.openMaps')}
          </a>
        </Button>
      </div>

      {order.deliveryStatus === 'ASSIGNED' && (
        <Button
          size="xl"
          className="w-full rounded-2xl"
          disabled={disabledOffline}
          loading={startPending}
          onClick={() => onStart(order.orderId)}
        >
          <Play className="size-5" />
          {t('delivery.startDelivery')}
        </Button>
      )}

      {order.deliveryStatus === 'OUT_FOR_DELIVERY' && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="xl"
            disabled={disabledOffline}
            onClick={() => onDeliver(order)}
            className="rounded-2xl px-3 text-base sm:px-6 sm:text-lg"
          >
            <CheckCircle2 className="size-5 shrink-0" />
            <span className="truncate">{t('delivery.deliver')}</span>
          </Button>
          <Button
            variant="destructive"
            size="xl"
            disabled={disabledOffline}
            onClick={() => onFail(order)}
            className="rounded-2xl px-3 text-base sm:px-6 sm:text-lg"
          >
            <XCircle className="size-5 shrink-0" />
            <span className="truncate">
              {t('delivery.unableToDeliver', { defaultValue: 'Unable to Deliver' })}
            </span>
          </Button>
        </div>
      )}
    </Card>
  )
}
