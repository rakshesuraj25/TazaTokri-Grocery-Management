import { dec, formatMoney, formatQty, subMoney, sumMoney, toApiMoney } from '@/lib/money'
import type { SaleResponse } from './types'

export interface BuildUpiInput {
  upiId?: string | null
  payeeName?: string
  amount: string | number
}

export interface ReceiptCalculationSummary {
  receiptNumber: string
  itemCount: number
  subtotal: string
  discount: string
  hasDiscount: boolean
  finalAmount: string
}

/**
 * Computes authoritative receipt totals (subtotal, discount if applicable, final amount)
 * from a completed SaleResponse.
 */
export function calculateReceiptSummary(sale: SaleResponse): ReceiptCalculationSummary {
  const subtotalDec = sumMoney(sale.items.map((i) => i.lineTotal))
  const finalDec = dec(sale.totalAmount)
  const rawDiscount = subMoney(subtotalDec, finalDec)
  const hasDiscount = rawDiscount.gt(0)
  const discountDec = hasDiscount ? rawDiscount : dec(0)

  return {
    receiptNumber: `#${String(sale.id)}`,
    itemCount: sale.items.length,
    subtotal: subtotalDec.toFixed(2),
    discount: discountDec.toFixed(2),
    hasDiscount,
    finalAmount: finalDec.toFixed(2),
  }
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
    ...sale.items.map((item) => {
      const unitSuffix = item.baseUnit ? ` ${String(item.baseUnit).toLowerCase()}` : ''
      return `- ${item.vegetableName}: ${formatQty(item.quantity)}${unitSuffix} x ${formatMoney(item.unitPrice)} = ${formatMoney(item.lineTotal)}`
    }),
    '',
    `Total: ${formatMoney(sale.totalAmount)}`,
    'Thank you for shopping fresh!',
  ]
  return lines.join('\n')
}
