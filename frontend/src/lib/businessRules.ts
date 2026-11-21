/**
 * Business rules constants & display-only helpers.
 * The server is the authority on all these values.
 * These constants are for display-only hints in the UI.
 */
import type Decimal from 'decimal.js'
import { currentMinutesIST } from './dates'
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

export interface LowStockThresholds {
  KG: number
  BUNCH: number
  PIECE: number
}

export const DEFAULT_LOW_STOCK_THRESHOLDS: Readonly<LowStockThresholds> = {
  KG: LOW_STOCK_THRESHOLD_KG,
  BUNCH: LOW_STOCK_THRESHOLD_UNIT,
  PIECE: LOW_STOCK_THRESHOLD_UNIT,
}

const THRESHOLDS_STORAGE_KEY = 'tazatokri-low-stock-thresholds'

export function getLowStockThresholds(): LowStockThresholds {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_LOW_STOCK_THRESHOLDS }
    }
    const raw = window.localStorage.getItem(THRESHOLDS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LOW_STOCK_THRESHOLDS }
    const parsed = JSON.parse(raw) as Partial<LowStockThresholds>
    return {
      KG: Number(parsed.KG) > 0 ? Number(parsed.KG) : DEFAULT_LOW_STOCK_THRESHOLDS.KG,
      BUNCH: Number(parsed.BUNCH) > 0 ? Number(parsed.BUNCH) : DEFAULT_LOW_STOCK_THRESHOLDS.BUNCH,
      PIECE: Number(parsed.PIECE) > 0 ? Number(parsed.PIECE) : DEFAULT_LOW_STOCK_THRESHOLDS.PIECE,
    }
  } catch {
    return { ...DEFAULT_LOW_STOCK_THRESHOLDS }
  }
}

export function setLowStockThresholds(next: Partial<LowStockThresholds>): LowStockThresholds {
  const current = getLowStockThresholds()
  const updated: LowStockThresholds = {
    KG: Number(next.KG) > 0 ? Number(next.KG) : current.KG,
    BUNCH: Number(next.BUNCH) > 0 ? Number(next.BUNCH) : current.BUNCH,
    PIECE: Number(next.PIECE) > 0 ? Number(next.PIECE) : current.PIECE,
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(updated))
    }
  } catch {
    // ignore storage errors
  }
  return updated
}

export function resetLowStockThresholds(): LowStockThresholds {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(THRESHOLDS_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_LOW_STOCK_THRESHOLDS }
}

export function getLowStockThreshold(
  baseUnit?: string | null,
  customThresholds?: Partial<LowStockThresholds>,
): number {
  const thresholds = customThresholds
    ? { ...getLowStockThresholds(), ...customThresholds }
    : getLowStockThresholds()
  if (baseUnit === 'KG') return thresholds.KG
  if (baseUnit === 'BUNCH') return thresholds.BUNCH
  if (baseUnit === 'PIECE') return thresholds.PIECE
  return LOW_STOCK_THRESHOLD_UNIT
}

export function isOutOfStock(quantity: Decimalish | null | undefined): boolean {
  try {
    return dec(quantity).lte(0)
  } catch {
    return true
  }
}

export function isLowStock(
  quantity: Decimalish | null | undefined,
  baseUnit?: string | null,
  customThresholds?: Partial<LowStockThresholds>,
): boolean {
  try {
    const q = dec(quantity)
    return q.gt(0) && q.lte(getLowStockThreshold(baseUnit, customThresholds))
  } catch {
    return false
  }
}

export function getStockStatus(
  quantity: Decimalish | null | undefined,
  baseUnit?: string | null,
  customThresholds?: Partial<LowStockThresholds>,
): 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' {
  if (isOutOfStock(quantity)) return 'OUT_OF_STOCK'
  if (isLowStock(quantity, baseUnit, customThresholds)) return 'LOW_STOCK'
  return 'IN_STOCK'
}

/** Seconds to poll order status after Razorpay closes. */
export const PAYMENT_POLL_INTERVAL_MS = 3000

/** Max milliseconds to poll before giving up. */
export const PAYMENT_POLL_MAX_MS = 60000

/** IST timezone string. */
export const IST_TIMEZONE = 'Asia/Kolkata'

export interface StoreRules {
  minOrder: number
  deliveryFee: number
  freeDeliveryAbove: number
  cutoffTime: string
  storeOpen: boolean
  pincodes?: string[]
}

export const DEFAULT_STORE_RULES: StoreRules = {
  minOrder: MIN_ORDER_AMOUNT,
  deliveryFee: DELIVERY_FEE,
  freeDeliveryAbove: FREE_DELIVERY_THRESHOLD,
  cutoffTime: '18:00',
  storeOpen: true,
  pincodes: [],
}

function parseCutoffMinutes(cutoffTime?: string): number {
  if (!cutoffTime) return DELIVERY_CUTOFF_HOUR * 60
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(cutoffTime.trim())
  if (!match) return DELIVERY_CUTOFF_HOUR * 60
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Display-only delivery fee estimate (server is the authority):
 * - Rs 0 when subtotal <= 0
 * - rules.deliveryFee when 0 < subtotal < rules.freeDeliveryAbove
 * - Rs 0 when subtotal >= rules.freeDeliveryAbove
 */
export function estimateDeliveryFee(
  subtotal: Decimalish | null | undefined,
  rules: Pick<StoreRules, 'deliveryFee' | 'freeDeliveryAbove'> = DEFAULT_STORE_RULES,
): Decimal {
  const s = dec(subtotal)
  if (s.lte(0) || s.gte(rules.freeDeliveryAbove)) return dec(0)
  return dec(rules.deliveryFee)
}

/**
 * Display-only minimum order check (server is the authority).
 */
export function isMinimumOrderMet(
  subtotal: Decimalish | null | undefined,
  rules: Pick<StoreRules, 'minOrder'> = DEFAULT_STORE_RULES,
): boolean {
  return dec(subtotal).gte(rules.minOrder)
}

/**
 * Display-only cutoff check in IST (server is the authority):
 * Before cutoffTime (default 18:00 IST) = delivery today (true); at or after = tomorrow (false).
 */
export function isSameDayDeliveryIST(
  now: Date = new Date(),
  cutoffTime: string = DEFAULT_STORE_RULES.cutoffTime,
): boolean {
  return currentMinutesIST(now) < parseCutoffMinutes(cutoffTime)
}
