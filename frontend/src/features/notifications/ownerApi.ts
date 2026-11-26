import { api } from '@/lib/api'
import type { NotificationStatus } from './types'

export interface OwnerNotificationLog {
  id: number
  orderId: number
  customerId: number
  eventType: string
  channel: string
  language: string
  status: NotificationStatus
  errorDetail: string | null
  createdAt: string
}

export interface NotificationProviderStatus {
  cloudApiEnabled: boolean
  shopSupportPhone: string
  hasBusinessAccountId: boolean
}

export const ownerNotificationsApi = {
  getStatus: () => api.get<NotificationProviderStatus>('/api/owner/notifications/status'),
  getLogs: (status?: NotificationStatus) =>
    api.get<OwnerNotificationLog[]>(
      status
        ? `/api/owner/notifications/logs?status=${encodeURIComponent(status)}`
        : '/api/owner/notifications/logs',
    ),
  retry: (logId: number) =>
    api.post<OwnerNotificationLog>(`/api/owner/notifications/logs/${logId}/retry`),
}
