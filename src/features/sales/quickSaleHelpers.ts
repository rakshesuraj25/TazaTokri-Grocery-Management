import { formatMoney, formatQty, toApiMoney } from '@/lib/money'
import type { SaleResponse } from './types'

export interface BuildUpiInput {
  upiId?: string | null
  payeeName?: string
  amount: string | number
}

/**
 * Builds a standard `upi://pay` URI when a shop UPI ID is configured; returns null otherwise.
 */
export function buildUpiString({
  upiId,
  payeeName = 'TazaTokri',
  amount,
}: BuildUpiInput): string | null {
  const pa = (upiId ?? '').trim()
  if (!pa) return null
  const am = toApiMoney(amount)
  return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(am)}&cu=INR`
}

/**
 * Formats a clean plain-text WhatsApp receipt summary (no emojis) from an authoritative SaleResponse.
 */
export function buildWhatsAppReceiptText(
  sale: SaleResponse,
  shopName = 'TazaTokri',
): string {
  const lines = [
    `${shopName} — Bill #${sale.id}`,
    `Payment: ${sale.paymentMethod}`,
    '',
    ...sale.items.map(
      (item) =>
        `- ${item.vegetableName}: ${formatQty(item.quantity)} x ${formatMoney(item.unitPrice)} = ${formatMoney(item.lineTotal)}`,
    ),
    '',
    `Total: ${formatMoney(sale.totalAmount)}`,
    'Thank you for shopping fresh!',
  ]
  return lines.join('\n')
}
