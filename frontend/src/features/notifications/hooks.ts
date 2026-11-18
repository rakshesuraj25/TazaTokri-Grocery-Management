import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from './api'
import type {
  NotificationEventType,
  NotificationLanguage,
  UpdateNotificationPreferenceRequest,
} from './types'

export const notificationKeys = {
  all: ['notifications'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
  orderShare: (orderId: number | string, lang?: NotificationLanguage) =>
    [...notificationKeys.all, 'order-share', String(orderId), lang ?? 'default'] as const,
}

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => notificationsApi.getMyPreferences(),
    enabled,
  })
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateNotificationPreferenceRequest) =>
      notificationsApi.updateMyPreferences(body),
    onSuccess: (data) => {
      qc.setQueryData(notificationKeys.preferences(), data)
    },
  })
}

export function useTriggerOrderNotification() {
  return useMutation({
    mutationFn: ({
      orderId,
      eventType,
      language,
    }: {
      orderId: number | string
      eventType: NotificationEventType
      language?: NotificationLanguage
    }) => notificationsApi.triggerOrderNotification(orderId, eventType, language),
  })
}
