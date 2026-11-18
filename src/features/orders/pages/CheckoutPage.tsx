import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ShoppingBasket } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { useCartStore } from '@/features/cart/store'
import { useCustomerAddresses } from '@/features/users/hooks'
import { AddAddressDialog } from '@/features/users/components/AddAddressDialog'
import { estimateDeliveryFee, isMinimumOrderMet } from '@/lib/businessRules'
import { addMoney, mulMoney, sumMoney } from '@/lib/money'
import { toApiError } from '@/lib/api'
import { usePlaceOrder } from '../hooks'
import type { OrderPaymentMethod } from '../types'
import {
  CheckoutAddressStep,
  CheckoutPaymentStep,
  CheckoutStepBar,
  CheckoutSummaryCard,
  type CheckoutStep,
} from '../components/CheckoutSteps'

export default function CheckoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const items = useCartStore((s) => s.items)
  const clientRef = useCartStore((s) => s.clientRef)
  const clearCart = useCartStore((s) => s.clearCart)

  const addresses = useCustomerAddresses()
  const placeOrder = usePlaceOrder()

  const [step, setStep] = useState<CheckoutStep>(1)
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('COD')
  const [onlineDisabled, setOnlineDisabled] = useState(false)
  const [addAddrOpen, setAddAddrOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedAddressId && (addresses.data ?? []).length > 0) {
      const def = addresses.data!.find((a) => a.defaultAddress) ?? addresses.data![0]
      if (def) setSelectedAddressId(String(def.id))
    }
  }, [addresses.data, selectedAddressId])

  const subtotal = sumMoney(items.map((i) => mulMoney(i.pricePerUnit, i.count)))
  const deliveryFee = estimateDeliveryFee(subtotal)
  const estimatedTotal = addMoney(subtotal, deliveryFee)

  if (items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<ShoppingBasket className="size-8" aria-hidden />}
          title={t('shop.cartEmpty')}
          description={t('shop.cartEmptyHint')}
          actionLabel={t('nav.shop')}
          actionTo="/shop"
        />
      </div>
    )
  }

  const handlePlaceOrder = () => {
    if (!selectedAddressId) return
    setServerError(null)

    placeOrder.mutate(
      {
        clientRef,
        addressId: selectedAddressId,
        paymentMethod,
        items: items.map((i) => ({
          vegetableId: i.vegetableId,
          unitId: i.unitId,
          count: i.count,
        })),
      },
      {
        onSuccess: (order) => {
          clearCart()
          toast.success(t('orders.status.PLACED'))
          navigate(`/shop/orders/${order.id}`, { replace: true })
        },
        onError: (err) => {
          const apiErr = toApiError(err)
          if (
            apiErr.status === 400 &&
            apiErr.message.toLowerCase().includes('online payment is not available')
          ) {
            setOnlineDisabled(true)
            setPaymentMethod('COD')
            setServerError(
              t('checkout.onlineUnavailableNow', {
                defaultValue: 'Online payment is not available right now',
              }),
            )
            return
          }
          setServerError(apiErr.message)
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link to="/shop" aria-label={t('common.back')}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-organic text-2xl font-bold">{t('checkout.title')}</h1>
      </div>

      <CheckoutStepBar step={step} onSelectStep={setStep} />

      {serverError && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-tomato-light text-tomato rounded-2xl border border-red-200/70 p-3.5 text-sm font-medium"
        >
          {serverError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-4">
          <CheckoutAddressStep
            activeStep={step === 1}
            addresses={addresses.data ?? []}
            selectedAddressId={selectedAddressId}
            onSelectAddress={(id) => {
              setSelectedAddressId(id)
              setStep(2)
            }}
            onAddAddress={() => setAddAddrOpen(true)}
          />

          <CheckoutPaymentStep
            activeStep={step === 2}
            paymentMethod={paymentMethod}
            onlineDisabled={onlineDisabled}
            onSelectMethod={(method) => {
              setPaymentMethod(method)
              setStep(3)
            }}
          />
        </div>

        <CheckoutSummaryCard
          activeStep={step === 3}
          items={items}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          estimatedTotal={estimatedTotal}
          canPlace={Boolean(selectedAddressId) && isMinimumOrderMet(subtotal)}
          isPending={placeOrder.isPending}
          onPlaceOrder={handlePlaceOrder}
        />
      </div>

      <AddAddressDialog open={addAddrOpen} onClose={() => setAddAddrOpen(false)} />
    </div>
  )
}
