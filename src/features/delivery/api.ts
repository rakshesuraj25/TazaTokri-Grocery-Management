import { api } from '@/lib/api'
import type {
  DeliverCollectionInput,
  DeliveryAttempt,
  DeliveryOrder,
  DeliveryPerson,
} from './types'

export const deliveryApi = {
  /** Staff / Owner: list delivery personnel and assign orders */
  listPeople: () => api.get<DeliveryPerson[]>('/api/delivery/people'),

  assignOrder: (orderId: number | string, deliveryUserId: number | string) =>
    api.post<DeliveryAttempt>(`/api/orders/${orderId}/assign`, {
      deliveryUserId: Number(deliveryUserId),
    }),

  listOrderDeliveries: (orderId: number | string) =>
    api.get<DeliveryAttempt[]>(`/api/orders/${orderId}/deliveries`),

  /** Delivery role: own assigned orders */
  listMyOrders: () => api.get<DeliveryOrder[]>('/api/delivery/orders'),

  startDelivery: (orderId: number | string) =>
    api.post<DeliveryAttempt>(`/api/delivery/orders/${orderId}/start`),

  markDelivered: (orderId: number | string, body?: DeliverCollectionInput) =>
    api.post<DeliveryAttempt>(`/api/delivery/orders/${orderId}/deliver`, body ?? {}),

  markFailed: (orderId: number | string, reason: string) =>
    api.post<DeliveryAttempt>(`/api/delivery/orders/${orderId}/fail`, { reason }),
}
