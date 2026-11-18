import { useTranslation } from 'react-i18next'
import { Check, Package, Truck, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EstimatedAmount, MoneyDisplay } from '@/components/MoneyDisplay'
import { StatusBadge } from '@/components/StatusBadge'
import { VegetableImage } from '@/components/VegetableImage'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { fmtDate, fmtTime } from '@/lib/dates'
import { formatQty } from '@/lib/money'
import type { OrderResponse } from '../types'

interface StaffOrderCardProps {
  order: OrderResponse
  catalogById: Map<string, StaffCatalogItem>
  confirmPending: boolean
  onConfirm: (order: OrderResponse) => void
  onPack: (order: OrderResponse) => void
  onAssign: (order: OrderResponse) => void
  onCancel: (order: OrderResponse) => void
}

export function StaffOrderCard({
  order,
  catalogById,
  confirmPending,
  onConfirm,
  onPack,
  onAssign,
  onCancel,
}: StaffOrderCardProps) {
  const { t } = useTranslation()

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold">#{order.id}</h2>
            <StatusBadge kind="order" status={order.status} />
            <Badge variant="outline">{order.paymentMethod}</Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {order.deliveryAddress} ({order.deliveryPincode}) ·{' '}
            {fmtDate(order.deliveryDate)} · {fmtTime(order.createdAt)}
          </p>
        </div>

        <div className="text-right">
          {order.finalTotal !== null ? (
            <div>
              <span className="text-muted-foreground block text-xs">
                {t('orders.finalBill')}
              </span>
              <MoneyDisplay
                value={order.finalTotal}
                className="font-display text-primary text-lg font-extrabold"
              />
            </div>
          ) : (
            <EstimatedAmount
              value={order.estimatedTotal}
              className="font-display text-primary text-lg font-extrabold"
            />
          )}
        </div>
      </div>

      {order.items.length > 0 && (
        <ul className="border-border/70 grid gap-2.5 border-t pt-3 text-xs sm:grid-cols-2">
          {order.items.map((item) => {
            const meta = catalogById.get(String(item.vegetableId))
            return (
              <li
                key={String(item.vegetableId)}
                className="flex items-center gap-2.5 font-medium"
              >
                <VegetableImage
                  nameEn={item.vegetableName}
                  imageUrl={meta?.imageUrl}
                  category={meta?.category}
                  size="xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.vegetableName}</p>
                  <p className="text-muted-foreground">
                    {item.actualQuantity !== null
                      ? t('staff.orders.packedVsOrdered', {
                          actual: formatQty(item.actualQuantity),
                          ordered: formatQty(item.quantity),
                          defaultValue: '{{actual}} packed (ordered {{ordered}})',
                        })
                      : `${formatQty(item.quantity)}`}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="border-border/70 flex flex-wrap items-center gap-2 border-t pt-2.5">
        {order.status === 'PLACED' && (
          <Button
            size="sm"
            loading={confirmPending}
            onClick={() => onConfirm(order)}
            className="rounded-full"
          >
            <Check className="size-4" />
            {t('staff.orders.confirm')}
          </Button>
        )}

        {order.status === 'CONFIRMED' && (
          <Button size="sm" onClick={() => onPack(order)} className="rounded-full">
            <Package className="size-4" />
            {t('staff.orders.pack')}
          </Button>
        )}

        {order.status === 'PACKED' && (
          <Button size="sm" onClick={() => onAssign(order)} className="rounded-full">
            <Truck className="size-4" />
            {t('staff.orders.assign')}
          </Button>
        )}

        {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive ml-auto rounded-full"
            onClick={() => onCancel(order)}
          >
            <XCircle className="size-4" />
            {t('staff.orders.cancel')}
          </Button>
        )}
      </div>
    </Card>
  )
}
