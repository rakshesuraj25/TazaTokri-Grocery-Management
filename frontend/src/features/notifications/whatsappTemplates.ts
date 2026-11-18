import type { OrderStatus } from '@/features/orders/types'
import { formatMoney } from '@/lib/money'
import type { NotificationEventType, NotificationLanguage } from './types'

export function mapOrderStatusToEvent(status: OrderStatus): NotificationEventType {
  switch (status) {
    case 'PENDING_PAYMENT':
    case 'PLACED':
      return 'ORDER_PLACED'
    case 'CONFIRMED':
      return 'ORDER_CONFIRMED'
    case 'PACKED':
      return 'ORDER_PACKED'
    case 'OUT_FOR_DELIVERY':
      return 'OUT_FOR_DELIVERY'
    case 'DELIVERED':
      return 'DELIVERED'
    case 'CANCELLED':
      return 'CANCELLED'
  }
}

export function normalizeIndianWhatsAppPhone(rawPhone?: string | null): string {
  if (!rawPhone) return ''
  const digits = rawPhone.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return digits
}

export function buildWaMeUrl(rawPhone: string | null | undefined, message: string): string {
  const phone = normalizeIndianWhatsAppPhone(rawPhone)
  const encoded = encodeURIComponent(message)
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}

export interface FormatOrderWhatsAppInput {
  event: NotificationEventType
  orderId: number | string
  customerName?: string | null
  billAmount?: string | number | null
  language?: NotificationLanguage
}

/**
 * Generates localized English, Marathi, and Hindi WhatsApp order status messages
 * matching the TazaTokri Phase 2 specification.
 */
export function formatOrderWhatsAppMessage({
  event,
  orderId,
  customerName,
  billAmount,
  language = 'EN',
}: FormatOrderWhatsAppInput): string {
  const cleanName = (customerName ?? '').trim()
  const hasBill = billAmount !== undefined && billAmount !== null && billAmount !== ''
  const billSuffix = hasBill ? ` (${formatMoney(billAmount)})` : ''

  if (language === 'MR') {
    const prefix = cleanName ? `नमस्कार ${cleanName}!` : 'नमस्कार!'
    switch (event) {
      case 'ORDER_PLACED':
        return `${prefix} तुमची ताजा टोकरी ऑर्डर #${orderId}${billSuffix} मिळाली आहे. ऑर्डर कन्फर्म झाल्यावर आम्ही तुम्हाला कळवू.`
      case 'ORDER_CONFIRMED':
        return `${prefix} तुमची ताजा टोकरी ऑर्डर #${orderId} कन्फर्म झाली आहे. आम्ही तुमच्या ताज्या भाज्या तयार करत आहोत.`
      case 'ORDER_PACKED':
        return `${prefix} तुमची ताजा टोकरी ऑर्डर #${orderId}${billSuffix} पॅक झाली असून डिलिव्हरीसाठी तयार आहे.`
      case 'OUT_FOR_DELIVERY':
        return `${prefix} तुमची ताजा टोकरी ऑर्डर #${orderId}${billSuffix} डिलिव्हरीसाठी निघाली आहे. ताजा टोकरी निवडल्याबद्दल धन्यवाद!`
      case 'DELIVERED':
        return `${prefix} तुमची ताजा टोकरी ऑर्डर #${orderId}${billSuffix} पोहोचवण्यात आली आहे. ताजा टोकरी निवडल्याबद्दल धन्यवाद!`
      case 'CANCELLED':
        return `${prefix} तुमची ताजा टोकरी ऑर्डर #${orderId} रद्द करण्यात आली आहे. मदतीसाठी कृपया आमच्याशी संपर्क साधा.`
    }
  }

  if (language === 'HI') {
    const prefix = cleanName ? `नमस्ते ${cleanName}!` : 'नमस्ते!'
    switch (event) {
      case 'ORDER_PLACED':
        return `${prefix} आपका ताज़ा टोकरी ऑर्डर #${orderId}${billSuffix} प्राप्त हो गया है। ऑर्डर कन्फर्म होने पर हम आपको सूचित करेंगे।`
      case 'ORDER_CONFIRMED':
        return `${prefix} आपका ताज़ा टोकरी ऑर्डर #${orderId} कन्फर्म हो गया है। हम आपकी ताज़ी सब्ज़ियाँ तैयार कर रहे हैं।`
      case 'ORDER_PACKED':
        return `${prefix} आपका ताज़ा टोकरी ऑर्डर #${orderId}${billSuffix} पैक हो चुका है और डिलीवरी के लिए तैयार है।`
      case 'OUT_FOR_DELIVERY':
        return `${prefix} आपका ताज़ा टोकरी ऑर्डर #${orderId}${billSuffix} डिलीवरी के लिए निकल चुका है। ताज़ा टोकरी से खरीदारी के लिए धन्यवाद!`
      case 'DELIVERED':
        return `${prefix} आपका ताज़ा टोकरी ऑर्डर #${orderId}${billSuffix} डिलीवर हो गया है। ताज़ा टोकरी चुनने के लिए धन्यवाद!`
      case 'CANCELLED':
        return `${prefix} आपका ताज़ा टोकरी ऑर्डर #${orderId} रद्द कर दिया गया है। किसी भी सहायता के लिए कृपया हमसे संपर्क करें।`
    }
  }

  const greeting = cleanName ? `Hello ${cleanName}!` : 'Hello!'
  const hiPrefix = cleanName ? `Hi ${cleanName}, ` : ''
  switch (event) {
    case 'ORDER_PLACED':
      return `${greeting} Your TazaTokri order #${orderId}${billSuffix} has been received. We will update you when it is confirmed.`
    case 'ORDER_CONFIRMED':
      return `${hiPrefix}Your TazaTokri order #${orderId} is confirmed. We are preparing your vegetables.`
    case 'ORDER_PACKED':
      return `${hiPrefix}Your TazaTokri order #${orderId}${billSuffix} is packed and ready for delivery.`
    case 'OUT_FOR_DELIVERY':
      return `${hiPrefix}Your TazaTokri order #${orderId}${billSuffix} is out for delivery. Thank you for shopping with TazaTokri!`
    case 'DELIVERED':
      return `${hiPrefix}Your TazaTokri order #${orderId}${billSuffix} has been delivered. Thank you for choosing TazaTokri!`
    case 'CANCELLED':
      return `${hiPrefix}Your TazaTokri order #${orderId} has been cancelled. Please contact us if you need assistance.`
  }
}

export function buildCustomerSupportWaUrl(
  orderId: number | string,
  status: OrderStatus,
  shopPhone = import.meta.env.VITE_SHOP_WHATSAPP_PHONE || '9999999999',
): string {
  const text = `Hello TazaTokri! I need help with my order #${orderId} (status: ${status}).`
  return buildWaMeUrl(shopPhone, text)
}
