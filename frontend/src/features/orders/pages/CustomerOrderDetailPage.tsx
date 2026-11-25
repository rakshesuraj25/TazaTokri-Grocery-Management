import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookmarkPlus, Printer, RotateCcw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/EmptyState'
import { EstimatedAmount, MoneyDisplay } from '@/components/MoneyDisplay'
import { StatusBadge } from '@/components/StatusBadge'
import { ListSkeleton } from '@/components/Skeletons'
import { VegetableImage } from '@/components/VegetableImage'
import { useCartStore } from '@/features/cart/store'
import { useAuthStore } from '@/features/auth/store'
import { usePublicVegetables } from '@/features/catalog/hooks'
import { SaveCurrentBasketDialog } from '@/features/baskets/components/SaveCurrentBasketDialog'
import { CustomerOrderWhatsAppBar } from '@/features/notifications/components/CustomerOrderWhatsAppBar'
import { PAYMENT_POLL_INTERVAL_MS } from '@/lib/businessRules'
import { fmtDate } from '@/lib/dates'
import { formatQty } from '@/lib/money'
import { toApiError } from '@/lib/api'
import {
  useCancelCustomerOrder,
  useCustomerOrder,
  useFailOnlinePayment,
  useStartOnlinePayment,
  useVerifyOnlinePayment,
} from '../hooks'
import { mapOrderItemsToCart } from '../orderAgain'
import {
  CustomerOrderReceiptDialog,
  resolveOrderDocumentKind,
} from '../components/CustomerOrderReceiptDialog'
import { OrderStatusStepper } from '../components/OrderStatusStepper'
import { PendingPaymentCard } from '../components/PendingPaymentCard'

interface RazorpaySuccessPayload {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayFailedPayload {
  error?: {
    description?: string
    reason?: string
    metadata?: {
      order_id?: string
      payment_id?: string
    }
  }
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void
      on?: (event: string, handler: (res: RazorpayFailedPayload) => void) => void
    }
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function CustomerOrderDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [polling, setPolling] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [skippedNotice, setSkippedNotice] = useState<string[]>([])
  const [saveBasketOpen, setSaveBasketOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)

  const orderQuery = useCustomerOrder(id, polling ? PAYMENT_POLL_INTERVAL_MS : false)
  const catalog = usePublicVegetables()
  const cancelOrder = useCancelCustomerOrder()
  const startPay = useStartOnlinePayment()
  const verifyPay = useVerifyOnlinePayment()
  const failPay = useFailOnlinePayment()
  const payingRef = useRef(false)
  const addItem = useCartStore((s) => s.addItem)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (polling && orderQuery.data && orderQuery.data.status !== 'PENDING_PAYMENT') {
      setPolling(false)
    }
  }, [polling, orderQuery.data])

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

  const handlePayNow = async () => {
    if (payingRef.current || startPay.isPending || verifyPay.isPending) return
    payingRef.current = true
    setPayError(null)
    const isLoaded = await loadRazorpayScript()
    if (!isLoaded && !window.Razorpay) {
      payingRef.current = false
      setPayError(
        t('checkout.gatewaySdkLoadError', {
          defaultValue: 'Unable to load payment gateway SDK. Please check your internet connection.',
        }),
      )
      return
    }

    startPay.mutate(order.id, {
      onSuccess: (init) => {
        if (window.Razorpay) {
          const rzp = new window.Razorpay({
            key: init.keyId,
            amount: init.amountPaise,
            currency: init.currency,
            order_id: init.razorpayOrderId,
            name: 'TazaTokri',
            description: `Payment for Order #${order.id}`,
            prefill: {
              name: user?.fullName,
              contact: user?.phone,
            },
            theme: {
              color: '#2F6B45',
            },
            modal: {
              ondismiss: () => {
                payingRef.current = false
                setPolling(false)
              },
            },
            handler: (res: RazorpaySuccessPayload) => {
              if (!res?.razorpay_order_id || !res?.razorpay_payment_id || !res?.razorpay_signature) {
                payingRef.current = false
                setPolling(false)
                setPayError(
                  t('checkout.invalidGatewayResponse', {
                    defaultValue: 'Incomplete payment response received. Please try again.',
                  }),
                )
                return
              }
              setPolling(true)
              verifyPay.mutate(
                {
                  orderId: order.id,
                  body: {
                    razorpayOrderId: res.razorpay_order_id,
                    razorpayPaymentId: res.razorpay_payment_id,
                    razorpaySignature: res.razorpay_signature,
                  },
                },
                {
                  onSuccess: () => {
                    payingRef.current = false
                    setPolling(false)
                    setPayError(null)
                    toast.success(
                      t('checkout.paymentVerified', { defaultValue: 'Payment verified and order placed!' }),
                    )
                  },
                  onError: (err) => {
                    payingRef.current = false
                    setPolling(false)
                    setPayError(toApiError(err).message)
                  },
                },
              )
            },
          })
          rzp.on?.('payment.failed', (res: RazorpayFailedPayload) => {
            payingRef.current = false
            setPolling(false)
            const msg =
              res?.error?.description ||
              t('checkout.paymentFailed', {
                defaultValue: 'Payment failed. You can try paying again.',
              })
            setPayError(msg)
            failPay.mutate({
              orderId: order.id,
              body: {
                razorpayOrderId: res?.error?.metadata?.order_id || init.razorpayOrderId,
                razorpayPaymentId: res?.error?.metadata?.payment_id,
                reason: res?.error?.reason || msg,
              },
            })
          })
          rzp.open()
        } else {
          payingRef.current = false
          setPolling(true)
        }
      },
      onError: (err) => {
        payingRef.current = false
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
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 min-[390px]:px-4 sm:px-6 sm:py-6">
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

      <CustomerOrderWhatsAppBar order={order} />

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
        {resolveOrderDocumentKind(order) !== 'UNPAID_NOTICE' && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setReceiptOpen(true)}
          >
            <Printer className="size-4" aria-hidden />
            {resolveOrderDocumentKind(order) === 'PAYMENT_RECEIPT'
              ? t('orders.printPaymentReceipt', { defaultValue: 'Print Receipt' })
              : t('orders.printOrderConfirmation', { defaultValue: 'Print Confirmation' })}
          </Button>
        )}
        {catalog.data && (
          <>
            <Button type="button" variant="secondary" className="flex-1" onClick={handleOrderAgain}>
              <RotateCcw className="size-4" aria-hidden />
              {t('orders.orderAgain', { defaultValue: 'Order again' })}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setSaveBasketOpen(true)}
            >
              <BookmarkPlus className="size-4" aria-hidden />
              {t('baskets.saveOrderAsBasket', { defaultValue: 'Save as basket' })}
            </Button>
          </>
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

      <CustomerOrderReceiptDialog
        order={receiptOpen ? order : null}
        onClose={() => setReceiptOpen(false)}
      />

      {catalog.data && (
        <SaveCurrentBasketDialog
          open={saveBasketOpen}
          items={mapOrderItemsToCart(order.items, catalog.data).matched}
          onClose={() => setSaveBasketOpen(false)}
        />
      )}
    </div>
  )
}
