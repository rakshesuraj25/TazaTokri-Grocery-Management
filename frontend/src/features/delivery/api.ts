import { api } from '@/lib/api'
import type {
  DeliverCollectionInput,
  DeliveryAttempt,
  DeliveryAuditLogResponse,
  DeliveryEvidenceResponse,
  DeliveryOrder,
  DeliveryPerson,
  OtpIssueResponse,
  OtpVerifyResponse,
  StaffDeliveryBoardResponse,
} from './types'

export const deliveryApi = {
  /** Staff / Owner: list delivery personnel and assign orders */
  listPeople: () => api.get<DeliveryPerson[]>('/api/delivery/people'),

  getStaffBoard: (params?: {
    date?: string
    stage?: string
    pincode?: string
    deliveryUserId?: number | string
  }) => {
    const qs = new URLSearchParams()
    if (params?.date) qs.set('date', params.date)
    if (params?.stage && params.stage !== 'ALL') qs.set('stage', params.stage)
    if (params?.pincode) qs.set('pincode', params.pincode)
    if (params?.deliveryUserId) qs.set('deliveryUserId', String(params.deliveryUserId))
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return api.get<StaffDeliveryBoardResponse>(`/api/delivery/admin/board${query}`)
  },

  assignOrder: (orderId: number | string, deliveryUserId: number | string) =>
    api.post<DeliveryAttempt>(`/api/orders/${orderId}/assign`, {
      deliveryUserId: Number(deliveryUserId),
    }),

  returnToStore: (orderId: number | string, note?: string) =>
    api.post<DeliveryAttempt>(`/api/orders/${orderId}/return-to-store`, { note }),

  listOrderDeliveries: (orderId: number | string) =>
    api.get<DeliveryAttempt[]>(`/api/orders/${orderId}/deliveries`),

  listOrderAuditTrail: (orderId: number | string) =>
    api.get<DeliveryAuditLogResponse[]>(`/api/orders/${orderId}/delivery-audit`),

  listOrderEvidences: (orderId: number | string) =>
    api.get<DeliveryEvidenceResponse[]>(`/api/orders/${orderId}/delivery-evidence`),

  /** Delivery role: own assigned orders */
  listMyOrders: () => api.get<DeliveryOrder[]>('/api/delivery/orders'),

  startDelivery: (orderId: number | string) =>
    api.post<DeliveryAttempt>(`/api/delivery/orders/${orderId}/start`),

  issueOtp: (orderId: number | string) =>
    api.post<OtpIssueResponse>(`/api/delivery/orders/${orderId}/otp/issue`),

  verifyOtp: (orderId: number | string, otp: string) =>
    api.post<OtpVerifyResponse>(`/api/delivery/orders/${orderId}/otp/verify`, { otp }),

  manualOtpOverride: (orderId: number | string, reason: string) =>
    api.post<OtpVerifyResponse>(`/api/delivery/orders/${orderId}/otp/manual-override`, {
      reason,
    }),

  uploadProofPhoto: (orderId: number | string, file: File, note?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (note && note.trim()) {
      form.append('note', note.trim())
    }
    return api.post<DeliveryEvidenceResponse>(`/api/delivery/orders/${orderId}/proof`, form)
  },

  markDelivered: (orderId: number | string, body?: DeliverCollectionInput) =>
    api.post<DeliveryAttempt>(`/api/delivery/orders/${orderId}/deliver`, body ?? {}),

  markFailed: (orderId: number | string, reason: string) =>
    api.post<DeliveryAttempt>(`/api/delivery/orders/${orderId}/fail`, { reason }),
}
