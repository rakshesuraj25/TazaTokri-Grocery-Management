import { useEffect, useRef, useState } from 'react'
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
import { usePublicStoreSettings } from '@/features/settings/hooks'
import { useMyLoyalty } from '@/features/loyalty/api'
import { retentionApi, type PromoPreview } from '@/features/retention/api'
import { useAuthStore } from '@/features/auth/store'
import { addMoney, dec, mulMoney, sumMoney } from '@/lib/money'
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
  const combos = useCartStore((s) => s.combos)
  const clientRef = useCartStore((s) => s.clientRef)
  const clearCart = useCartStore((s) => s.clearCart)

  const addresses = useCustomerAddresses()
  const { settings } = usePublicStoreSettings()
  const user = useAuthStore((s) => s.user)
  const loyaltyQuery = useMyLoyalty(Boolean(user))
  const placeOrder = usePlaceOrder()

  const [step, setStep] = useState<CheckoutStep>(1)
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('COD')
  const [onlineDisabled, setOnlineDisabled] = useState(false)
  const [addAddrOpen, setAddAddrOpen] = useState(false)
  const [redeemPointsInput, setRedeemPointsInput] = useState<string>('')
  const [promoInput, setPromoInput] = useState<string>('')
  const [appliedPromo, setAppliedPromo] = useState<PromoPreview | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!selectedAddressId && (addresses.data ?? []).length > 0) {
      const def = addresses.data!.find((a) => a.defaultAddress) ?? addresses.data![0]
      if (def) setSelectedAddressId(String(def.id))
    }
  }, [addresses.data, selectedAddressId])

  const itemsSubtotal = sumMoney(items.map((i) => mulMoney(i.pricePerUnit, i.count)))
  const combosSubtotal = sumMoney(combos.map((c) => mulMoney(c.sellingPrice, c.count)))
  const subtotal = addMoney(itemsSubtotal, combosSubtotal)
  const deliveryFee = estimateDeliveryFee(subtotal, settings)

  const loyalty = loyaltyQuery.data
  const parsedRedeem = redeemPointsInput.trim() === '' ? 0 : Math.floor(Number(redeemPointsInput))
  const redeemPoints =
    loyalty?.enabled && Number.isFinite(parsedRedeem) && parsedRedeem > 0 ? parsedRedeem : 0
  const maxAllowedRedeem = loyalty?.enabled
    ? Math.min(
        loyalty.balance,
        loyalty.maxRedeemPointsPerOrder,
        Math.floor(subtotal.div(loyalty.rupeesPerPoint || 1).toNumber()),
      )
    : 0
  const redeemError =
    redeemPoints > 0 && loyalty?.enabled
      ? redeemPoints < loyalty.minRedeemPoints
        ? `Minimum ${loyalty.minRedeemPoints} points required to redeem.`
        : redeemPoints > loyalty.balance
          ? `Insufficient points balance (${loyalty.balance} pts available).`
          : redeemPoints > loyalty.maxRedeemPointsPerOrder
            ? `Maximum ${loyalty.maxRedeemPointsPerOrder} points allowed per order.`
            : redeemPoints > maxAllowedRedeem
              ? 'Redemption discount cannot exceed items subtotal.'
              : null
      : null
  const loyaltyDiscount =
    loyalty?.enabled && redeemPoints > 0 && !redeemError
      ? dec(redeemPoints).mul(loyalty.rupeesPerPoint)
      : dec(0)
  const promoDiscount = appliedPromo ? dec(appliedPromo.discountAmount) : dec(0)
  const estimatedTotal = addMoney(
    subtotal.sub(loyaltyDiscount).sub(promoDiscount).lt(0)
      ? dec(0)
      : subtotal.sub(loyaltyDiscount).sub(promoDiscount),
    deliveryFee,
  )
  const estimatedPointsEarned = loyalty?.enabled
    ? Math.floor(
        Math.max(0, subtotal.sub(loyaltyDiscount).sub(promoDiscount).toNumber()) *
          (loyalty.pointsPer100Inr / 100),
      )
    : 0

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    setPromoLoading(true)
    setPromoError(null)
    try {
      const preview = await retentionApi.validatePromo(
        code,
        subtotal.toNumber(),
        loyaltyDiscount.toNumber(),
      )
      setAppliedPromo(preview)
    } catch (err) {
      setAppliedPromo(null)
      setPromoError(toApiError(err).message)
    } finally {
      setPromoLoading(false)
    }
  }

  const handleRemovePromo = () => {
    setAppliedPromo(null)
    setPromoInput('')
    setPromoError(null)
  }
  const selectedAddress = (addresses.data ?? []).find((a) => String(a.id) === selectedAddressId)
  const selectedPinServiceable =
    !selectedAddress ||
    settings.pincodes.length === 0 ||
    settings.pincodes.includes(selectedAddress.pincode.trim())

  if (items.length === 0 && combos.length === 0) {
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
    if (!selectedAddressId || placeOrder.isPending || submittingRef.current) return
    submittingRef.current = true
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
        ...(combos.length > 0
          ? {
              combos: combos.map((c) => ({
                comboId: Number(c.comboId),
                count: c.count,
              })),
            }
          : {}),
        ...(redeemPoints > 0 && !redeemError ? { redeemPoints } : {}),
        ...(appliedPromo ? { promoCode: appliedPromo.code } : {}),
      },
      {
        onSuccess: (order) => {
          submittingRef.current = false
          clearCart()
          toast.success(t('orders.status.PLACED'))
          navigate(`/shop/orders/${order.id}`, { replace: true })
        },
        onError: (err) => {
          submittingRef.current = false
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

      {!settings.storeOpen && (
        <div
          role="alert"
          className="bg-turmeric-light text-turmeric-foreground rounded-2xl border border-amber-300/70 p-3.5 text-sm font-medium"
        >
          {t('shop.storePausedBanner', {
            defaultValue:
              'Store is currently paused for new online orders. Existing orders are not affected.',
          })}
        </div>
      )}

      {selectedAddress && !selectedPinServiceable && (
        <div
          role="alert"
          className="bg-tomato-light text-tomato rounded-2xl border border-red-200/70 p-3.5 text-sm font-medium"
        >
          {t('checkout.unserviceablePin', {
            pincode: selectedAddress.pincode,
            defaultValue: `We do not deliver to PIN code ${selectedAddress.pincode} right now. Please choose or add another address.`,
          })}
        </div>
      )}

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
            serviceablePincodes={settings.pincodes}
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
          combos={combos}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          estimatedTotal={estimatedTotal}
          rules={settings}
          loyalty={loyalty}
          redeemPointsInput={redeemPointsInput}
          onRedeemPointsChange={setRedeemPointsInput}
          maxRedeemPoints={maxAllowedRedeem}
          redeemError={redeemError}
          loyaltyDiscount={loyaltyDiscount}
          estimatedPointsEarned={estimatedPointsEarned}
          promoInput={promoInput}
          onPromoInputChange={setPromoInput}
          appliedPromo={appliedPromo}
          promoError={promoError}
          promoLoading={promoLoading}
          onApplyPromo={() => void handleApplyPromo()}
          onRemovePromo={handleRemovePromo}
          canPlace={
            Boolean(selectedAddressId) &&
            settings.storeOpen &&
            selectedPinServiceable &&
            !redeemError &&
            isMinimumOrderMet(subtotal, settings)
          }
          isPending={placeOrder.isPending}
          onPlaceOrder={handlePlaceOrder}
        />
      </div>

      <AddAddressDialog
        open={addAddrOpen}
        onClose={() => setAddAddrOpen(false)}
        onCreated={(addr) => {
          setSelectedAddressId(String(addr.id))
          setStep(2)
        }}
      />
    </div>
  )
}
