import { api } from '@/lib/api'
import type {
  NotificationEventType,
  NotificationLanguage,
  NotificationPreference,
  OrderNotificationResponse,
  UpdateNotificationPreferenceRequest,
} from './types'

export const notificationsApi = {
  getMyPreferences: () =>
    api.get<NotificationPreference>('/api/my/notifications/preferences'),

  updateMyPreferences: (body: UpdateNotificationPreferenceRequest) =>
    api.put<NotificationPreference>('/api/my/notifications/preferences', body),

  getCustomerOrderShare: (orderId: number | string, language?: NotificationLanguage) => {
    const qs = language ? `?language=${encodeURIComponent(language)}` : ''
    return api.get<OrderNotificationResponse>(`/api/my/orders/${orderId}/whatsapp-share${qs}`)
  },

  triggerOrderNotification: (
    orderId: number | string,
    eventType: NotificationEventType,
    language?: NotificationLanguage,
  ) => {
    const qs = language ? `?language=${encodeURIComponent(language)}` : ''
    return api.post<OrderNotificationResponse>(
      `/api/orders/${orderId}/notifications/${eventType}${qs}`,
    )
  },
}
