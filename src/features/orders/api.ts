import { api } from '@/lib/api'
import type {
  OrderResponse,
  OrderStatus,
  PackOrderRequest,
  PaymentInitResponse,
  PlaceOrderRequest,
  VerifyPaymentRequest,
} from './types'

export const ordersApi = {
  /** Customer order endpoints */
  placeCustomerOrder: (body: PlaceOrderRequest) =>
    api.post<OrderResponse>('/api/customer/orders', {
      ...body,
      addressId: Number(body.addressId),
      items: body.items.map((i) => ({
        vegetableId: Number(i.vegetableId),
        unitId: Number(i.unitId),
        count: i.count,
      })),
    }),

  listCustomerOrders: (page = 0) =>
    api.get<OrderResponse[]>(`/api/customer/orders?page=${page}`),

  getCustomerOrder: (id: number | string) =>
    api.get<OrderResponse>(`/api/customer/orders/${id}`),

  cancelCustomerOrder: (id: number | string, reason?: string) =>
    api.post<OrderResponse>(`/api/customer/orders/${id}/cancel`, reason ? { reason } : {}),

  startOnlinePayment: (orderId: number | string) =>
    api.post<PaymentInitResponse>(`/api/customer/orders/${orderId}/payment`),

  verifyOnlinePayment: (orderId: number | string, body: VerifyPaymentRequest) =>
    api.post<{ orderId: number; status: OrderStatus }>(
      `/api/customer/orders/${orderId}/payment/verify`,
      body,
    ),

  /** Staff / Owner order endpoints */
  listStaffOrders: (params: { date?: string; status?: OrderStatus } = {}) => {
    const qs = new URLSearchParams()
    if (params.date) qs.set('date', params.date)
    if (params.status) qs.set('status', params.status)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api.get<OrderResponse[]>(`/api/orders${suffix}`)
  },

  getStaffOrder: (id: number | string) => api.get<OrderResponse>(`/api/orders/${id}`),

  confirmOrder: (id: number | string) =>
    api.post<OrderResponse>(`/api/orders/${id}/confirm`),

  packOrder: (id: number | string, body: PackOrderRequest) =>
    api.post<OrderResponse>(`/api/orders/${id}/pack`, {
      items: body.items.map((i) => ({
        vegetableId: Number(i.vegetableId),
        actualQuantity: i.actualQuantity,
      })),
    }),

  cancelStaffOrder: (id: number | string, reason: string) =>
    api.post<OrderResponse>(`/api/orders/${id}/cancel`, { reason }),
}
