import { useTranslation } from 'react-i18next'
import { HelpCircle, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuthStore } from '@/features/auth/store'
import type { OrderResponse } from '@/features/orders/types'
import {
  buildCustomerSupportWaUrl,
  buildWaMeUrl,
  formatOrderWhatsAppMessage,
  mapOrderStatusToEvent,
} from '../whatsappTemplates'
import type { NotificationLanguage } from '../types'

interface CustomerOrderWhatsAppBarProps {
  order: OrderResponse
}

export function CustomerOrderWhatsAppBar({ order }: CustomerOrderWhatsAppBarProps) {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)

  const currentLang: NotificationLanguage =
    i18n.language === 'mr' ? 'MR' : i18n.language === 'hi' ? 'HI' : 'EN'

  const event = mapOrderStatusToEvent(order.status)
  const bill = order.finalTotal !== null ? order.finalTotal : order.estimatedTotal
  const shareText = formatOrderWhatsAppMessage({
    event,
    orderId: order.id,
    customerName: user?.fullName,
    billAmount: bill,
    language: currentLang,
  })

  const shareUrl = buildWaMeUrl(null, shareText)
  const supportUrl = buildCustomerSupportWaUrl(order.id, order.status)

  return (
    <Card
      className="bg-secondary/45 flex flex-wrap items-center justify-between gap-3 p-4"
      data-testid="customer-order-whatsapp-bar"
    >
      <div className="space-y-0.5">
        <p className="font-display flex items-center gap-1.5 text-sm font-bold">
          <MessageCircle className="text-primary size-4" aria-hidden />
          {t('notifications.orderWhatsAppTitle', {
            defaultValue: 'WhatsApp Order Updates & Support',
          })}
        </p>
        <p className="text-muted-foreground text-xs">
          {t('notifications.orderWhatsAppHint', {
            defaultValue: 'Share this order status or message TazaTokri support on WhatsApp.',
          })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <a href={shareUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" aria-hidden />
            {t('notifications.shareStatusWa', { defaultValue: 'Share status' })}
          </a>
        </Button>

        <Button asChild variant="secondary" size="sm" className="rounded-full">
          <a href={supportUrl} target="_blank" rel="noopener noreferrer">
            <HelpCircle className="size-4" aria-hidden />
            {t('notifications.orderSupportWa', { defaultValue: 'WhatsApp support' })}
          </a>
        </Button>
      </div>
    </Card>
  )
}
