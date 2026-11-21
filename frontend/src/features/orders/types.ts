export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

export type OrderPaymentMethod = 'COD' | 'ONLINE'

export interface PlaceOrderItemInput {
  vegetableId: number | string
  unitId: number | string
  /** 1..20 */
  count: number
}

export interface PlaceOrderComboInput {
  comboId: number | string
  /** 1..10 */
  count: number
}

export interface PlaceOrderRequest {
  clientRef: string
  addressId: number | string
  paymentMethod: OrderPaymentMethod
  items: PlaceOrderItemInput[]
  combos?: PlaceOrderComboInput[]
  redeemPoints?: number
  promoCode?: string
}

export interface OrderItemResponse {
  vegetableId: number | string
  vegetableName: string
  quantity: string | number
  unitPrice: string | number
  estimatedLineTotal: string | number
  actualQuantity: string | number | null
  finalLineTotal: string | number | null
}

export interface OrderResponse {
  id: number | string
  status: OrderStatus
  paymentMethod: OrderPaymentMethod
  deliveryDate: string
  deliveryAddress: string
  deliveryPincode: string
  deliveryInstructions?: string | null
  subtotal: string | number
  deliveryFee: string | number
  estimatedTotal: string | number
  finalTotal: string | number | null
  createdAt: string
  items: OrderItemResponse[]
}

export interface PackOrderItemInput {
  vegetableId: number | string
  actualQuantity: string
}

export interface PackOrderRequest {
  items: PackOrderItemInput[]
}

export interface PaymentInitResponse {
  orderId: number | string
  keyId: string
  razorpayOrderId: string
  amountPaise: number
  currency: string
}

export interface VerifyPaymentRequest {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}
