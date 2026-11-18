import type { OrderStatus } from '@/features/orders/types'

export type NotificationLanguage = 'EN' | 'MR' | 'HI'

export type NotificationEventType =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

export type NotificationChannel = 'WHATSAPP_MANUAL' | 'WHATSAPP_CLOUD_API'

export type NotificationStatus =
  | 'PREPARED'
  | 'SENT'
  | 'SKIPPED_NO_CONSENT'
  | 'SKIPPED_DISABLED'
  | 'FAILED'

export interface NotificationPreference {
  userId: number | string
  whatsappOptIn: boolean
  consentTimestamp: string | null
  preferredLanguage: NotificationLanguage
  cloudApiEnabled: boolean
}

export interface UpdateNotificationPreferenceRequest {
  whatsappOptIn: boolean
  preferredLanguage: NotificationLanguage
}

export interface OrderNotificationResponse {
  orderId: number | string
  eventType: NotificationEventType
  currentOrderStatus: OrderStatus
  language: NotificationLanguage
  customerOptedIn: boolean
  alreadyNotified: boolean
  channel: NotificationChannel
  deliveryStatus: NotificationStatus
  messageText: string
  waMeUrl: string
  supportWaMeUrl: string
}
