import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, RotateCcw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/EmptyState'
import { EstimatedAmount, MoneyDisplay } from '@/components/MoneyDisplay'
import { StatusBadge } from '@/components/StatusBadge'
import { ListSkeleton } from '@/components/Skeletons'
import { VegetableImage } from '@/components/VegetableImage'
import { useCartStore } from '@/features/cart/store'
import { usePublicVegetables } from '@/features/catalog/hooks'
import { PAYMENT_POLL_INTERVAL_MS } from '@/lib/businessRules'
import { fmtDate } from '@/lib/dates'
import { formatQty } from '@/lib/money'
import { toApiError } from '@/lib/api'
import {
  useCancelCustomerOrder,
  useCustomerOrder,
  useStartOnlinePayment,
  useVerifyOnlinePayment,
} from '../hooks'
import { mapOrderItemsToCart } from '../orderAgain'
import { OrderStatusStepper } from '../components/OrderStatusStepper'
import { PendingPaymentCard } from '../components/PendingPaymentCard'

interface RazorpaySuccessPayload {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

export default function CustomerOrderDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [polling, setPolling] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [skippedNotice, setSkippedNotice] = useState<string[]>([])

  const orderQuery = useCustomerOrder(id, polling ? PAYMENT_POLL_INTERVAL_MS : false)
  const catalog = usePublicVegetables()
  const cancelOrder = useCancelCustomerOrder()
  const startPay = useStartOnlinePayment()
  const verifyPay = useVerifyOnlinePayment()
  const addItem = useCartStore((s) => s.addItem)

  if (orderQuery.isPending || orderQuery.isLoading) {
    return (
      <div className="p-4">
        <ListSkeleton rows={4} />
      </div>
    )
  }

  if (orderQuery.isError || !orderQuery.data) {
    return <ErrorState onRetry={() => void orderQuery.refetch()} />
  }

  const order = orderQuery.data
  if (polling && order.status !== 'PENDING_PAYMENT') {
    setPolling(false)
  }

  const handlePayNow = () => {
    setPayError(null)
    startPay.mutate(order.id, {
      onSuccess: (init) => {
        if (window.Razorpay) {
          const rzp = new window.Razorpay({
            key: init.keyId,
            amount: init.amountPaise,
            currency: init.currency,
            order_id: init.razorpayOrderId,
            name: 'TazaTokri',
            handler: (res: RazorpaySuccessPayload) => {
              setPolling(true)
              verifyPay.mutate({
                orderId: order.id,
                body: {
                  razorpayOrderId: res.razorpay_order_id,
                  razorpayPaymentId: res.razorpay_payment_id,
                  razorpaySignature: res.razorpay_signature,
                },
              })
            },
          })
          rzp.open()
        } else {
          setPolling(true)
        }
      },
      onError: (err) => {
        const apiErr = toApiError(err)
        setPayError(
          apiErr.status === 400 &&
            apiErr.message.toLowerCase().includes('online payment is not available')
            ? t('checkout.onlineUnavailableNow', {
                defaultValue: 'Online payment is not available right now',
              })
            : apiErr.message,
        )
      },
    })
  }

  const handleCancel = () => {
    cancelOrder.mutate(
      { id: order.id },
      {
        onSuccess: () => toast.success(t('orders.cancelSuccess')),
        onError: (err) => toast.error(toApiError(err).message),
      },
    )
  }

  const handleOrderAgain = () => {
    if (!catalog.data) return
    const { matched, skipped } = mapOrderItemsToCart(order.items, catalog.data)
    for (const item of matched) addItem(item)
    setSkippedNotice(skipped)
    if (matched.length > 0 && skipped.length === 0) {
      toast.success(t('orders.orderAgainAdded', { defaultValue: 'Added items to your cart' }))
      navigate('/shop')
    }
  }

  const canCancel =
    order.status === 'PENDING_PAYMENT' ||
    order.status === 'PLACED' ||
    order.status === 'CONFIRMED'

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon">
            <Link to="/shop/orders" aria-label={t('common.back')}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-organic text-2xl font-bold">#{order.id}</h1>
            <p className="text-muted-foreground text-xs">
              {t('orders.deliveryDate', { date: fmtDate(order.deliveryDate) })}
            </p>
          </div>
        </div>

        <StatusBadge kind="order" status={order.status} />
      </div>

      <Card className="p-4">
        <OrderStatusStepper status={order.status} />
      </Card>

      {payError && (
        <p role="alert" className="bg-tomato-light text-tomato rounded-xl p-3 text-sm font-medium">
          {payError}
        </p>
      )}

      {skippedNotice.length > 0 && (
        <div role="status" className="bg-turmeric-light text-turmeric-foreground rounded-xl p-3 text-xs font-medium">
          {t('orders.orderAgainPartial', {
            items: skippedNotice.join(', '),
            defaultValue: `Unmatched or unavailable lines skipped: ${skippedNotice.join(', ')}`,
          })}
        </div>
      )}

      {order.status === 'PENDING_PAYMENT' && (
        <PendingPaymentCard
          createdAt={order.createdAt}
          loading={startPay.isPending || verifyPay.isPending}
          onPayNow={handlePayNow}
        />
      )}

      <Card className="divide-border divide-y p-4">
        {order.items.map((item) => (
          <div
            key={String(item.vegetableId)}
            className="flex items-center justify-between gap-3 py-2.5 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <VegetableImage nameEn={item.vegetableName} size="xs" />
              <div className="min-w-0">
                <p className="font-display truncate font-bold">{item.vegetableName}</p>
                <p className="text-muted-foreground text-xs">
                  {item.actualQuantity !== null
                    ? `${formatQty(item.actualQuantity)} (ordered ${formatQty(item.quantity)})`
                    : formatQty(item.quantity)}{' '}
                  × <MoneyDisplay value={item.unitPrice} />
                </p>
              </div>
            </div>
            {item.finalLineTotal !== null ? (
              <MoneyDisplay value={item.finalLineTotal} className="font-display font-bold" />
            ) : (
              <EstimatedAmount
                value={item.estimatedLineTotal}
                className="font-display font-bold"
              />
            )}
          </div>
        ))}
      </Card>

      <Card className="space-y-1.5 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('cart.subtotal')}</span>
          <MoneyDisplay value={order.subtotal} />
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('cart.deliveryFee')}</span>
          <MoneyDisplay value={order.deliveryFee} />
        </div>
        <div className="flex justify-between border-t pt-2 font-bold">
          <span>
            {order.finalTotal !== null ? t('orders.finalBill') : t('orders.estimatedBill')}
          </span>
          {order.finalTotal !== null ? (
            <MoneyDisplay
              value={order.finalTotal}
              className="font-display text-primary text-lg font-extrabold"
            />
          ) : (
            <EstimatedAmount
              value={order.estimatedTotal}
              className="font-display text-primary text-lg font-extrabold"
            />
          )}
        </div>
        <p className="text-muted-foreground pt-1 text-xs">{t('orders.finalBillNote')}</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {catalog.data && (
          <Button type="button" variant="secondary" className="flex-1" onClick={handleOrderAgain}>
            <RotateCcw className="size-4" aria-hidden />
            {t('orders.orderAgain', { defaultValue: 'Order again' })}
          </Button>
        )}

        {canCancel && (
          <Button
            variant="outline"
            className="text-destructive flex-1"
            loading={cancelOrder.isPending}
            onClick={handleCancel}
          >
            <XCircle className="size-4" aria-hidden />
            {t('orders.cancelOrder')}
          </Button>
        )}
      </div>
    </div>
  )
}
