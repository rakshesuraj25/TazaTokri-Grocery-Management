import { useTranslation } from 'react-i18next'
import { CheckCircle2, MapPin, Phone, Play, XCircle } from 'lucide-react'
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
  onStart: (orderId: string | number) => void
  onDeliver: (order: DeliveryOrder) => void
  onFail: (order: DeliveryOrder) => void
}

export function DeliveryOrderCard({
  order,
  startPending,
  onStart,
  onDeliver,
  onFail,
}: DeliveryOrderCardProps) {
  const { t } = useTranslation()
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${order.address} ${order.pincode}`,
  )}`
  const hasDue = dec(order.amountToCollect).gt(0)

  return (
    <Card
      className={`space-y-3.5 p-4 ${
        order.deliveryStatus === 'OUT_FOR_DELIVERY'
          ? 'border-primary/60 bg-primary/[0.02] shadow-sm'
          : order.deliveryStatus === 'FAILED'
            ? 'border-destructive/40'
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
          </div>
          <p className="mt-1 font-semibold">{order.customerName}</p>
          <p className="text-muted-foreground text-sm break-words">
            {order.address} — {order.pincode}
          </p>
        </div>

        {hasDue ? (
          <div className="bg-turmeric-light text-turmeric-foreground shrink-0 rounded-2xl px-3 py-1.5 text-right">
            <span className="block text-xs font-semibold">
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

      <ul className="border-border/70 grid gap-2.5 border-t pt-3 text-xs sm:grid-cols-2">
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
        <Button asChild variant="outline" size="lg" className="rounded-2xl">
          <a href={`tel:${order.customerPhone}`}>
            <Phone className="size-4" />
            {t('delivery.callCustomer')}
          </a>
        </Button>
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
          loading={startPending}
          onClick={() => onStart(order.orderId)}
        >
          <Play className="size-5" />
          {t('delivery.startDelivery')}
        </Button>
      )}

      {order.deliveryStatus === 'OUT_FOR_DELIVERY' && (
        <div className="grid grid-cols-2 gap-2">
          <Button size="xl" onClick={() => onDeliver(order)} className="rounded-2xl">
            <CheckCircle2 className="size-5" />
            {t('delivery.deliver')}
          </Button>
          <Button
            variant="destructive"
            size="xl"
            onClick={() => onFail(order)}
            className="rounded-2xl"
          >
            <XCircle className="size-5" />
            {t('delivery.fail')}
          </Button>
        </div>
      )}
    </Card>
  )
}
