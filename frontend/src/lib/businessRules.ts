/**
 * Business rules constants & display-only helpers.
 * The server is the authority on all these values.
 * These constants are for display-only hints in the UI.
 */
import type Decimal from 'decimal.js'
import { currentHourIST } from './dates'
import { dec, type Decimalish } from './money'

/** Minimum order value in rupees for delivery (server is the authority). */
export const MIN_ORDER_AMOUNT = 150 // server is the authority

/** Delivery fee in rupees when subtotal is below FREE_DELIVERY_THRESHOLD (server is the authority). */
export const DELIVERY_FEE = 30 // server is the authority

/** Free delivery threshold in rupees: subtotal of Rs 300 or more is free (server is the authority). */
export const FREE_DELIVERY_THRESHOLD = 300 // server is the authority

/** Cutoff hour (24h, IST) for same-day delivery: 18:00 (6 PM) IST (server is the authority). */
export const DELIVERY_CUTOFF_HOUR = 18 // 18:00 (6 PM) IST — server is the authority

/** Online payment hold duration in minutes before an ONLINE order expires (server is the authority). */
export const ONLINE_ORDER_EXPIRY_MINUTES = 15 // server is the authority

/** Max items per unit in cart (server is the authority). */
export const MAX_ITEM_COUNT = 20 // server is the authority

/** Display-only low-stock threshold in kg (kg vegetables). */
export const LOW_STOCK_THRESHOLD_KG = 5

/** Display-only low-stock threshold for piece/bunch items. */
export const LOW_STOCK_THRESHOLD_UNIT = 5

export function getLowStockThreshold(baseUnit?: string | null): number {
  return baseUnit === 'KG' ? LOW_STOCK_THRESHOLD_KG : LOW_STOCK_THRESHOLD_UNIT
}

export function isLowStock(quantity: Decimalish | null | undefined, baseUnit?: string | null): boolean {
  const q = dec(quantity)
  return q.gt(0) && q.lte(getLowStockThreshold(baseUnit))
}

/** Seconds to poll order status after Razorpay closes. */
export const PAYMENT_POLL_INTERVAL_MS = 3000

/** Max milliseconds to poll before giving up. */
export const PAYMENT_POLL_MAX_MS = 60000

/** IST timezone string. */
export const IST_TIMEZONE = 'Asia/Kolkata'

/**
 * Display-only delivery fee estimate (server is the authority):
 * - Rs 0 when subtotal <= 0
 * - Rs 30 when 0 < subtotal < 300
 * - Rs 0 when subtotal >= 300
 */
export function estimateDeliveryFee(subtotal: Decimalish | null | undefined): Decimal {
  const s = dec(subtotal)
  if (s.lte(0) || s.gte(FREE_DELIVERY_THRESHOLD)) return dec(0)
  return dec(DELIVERY_FEE)
}

/**
 * Display-only minimum order check (server is the authority):
 * Orders under Rs 150 are rejected.
 */
export function isMinimumOrderMet(subtotal: Decimalish | null | undefined): boolean {
  return dec(subtotal).gte(MIN_ORDER_AMOUNT)
}

/**
 * Display-only cutoff check in IST (server is the authority):
 * Before 18:00 (6 PM) IST = delivery today (true); at or after 18:00 IST = tomorrow (false).
 */
export function isSameDayDeliveryIST(now: Date = new Date()): boolean {
  return currentHourIST(now) < DELIVERY_CUTOFF_HOUR
}
