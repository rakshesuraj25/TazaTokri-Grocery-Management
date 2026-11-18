/**
 * Money & quantity helpers (decimal.js — never float math).
 *
 * The contract says decimals arrive as strings, but the current Spring backend
 * serialises BigDecimal as JSON numbers. Every helper therefore accepts
 * `Decimalish` (string | number) and parses through Decimal.
 *
 * IMPORTANT: the client never decides what is charged. Anything computed
 * here is a DISPLAY estimate and must be labelled "Estimated".
 */
import Decimal from 'decimal.js'

export type Decimalish = string | number | Decimal

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function dec(value: Decimalish | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0)
  return value instanceof Decimal ? value : new Decimal(value)
}

/** Convert an API decimal to integer paise. */
export function toPaise(value: Decimalish): number {
  return dec(value).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

export function fromPaise(paise: number): Decimal {
  return new Decimal(paise).div(100)
}

export function addMoney(a: Decimalish, b: Decimalish): Decimal {
  return dec(a).plus(dec(b))
}

export function subMoney(a: Decimalish, b: Decimalish): Decimal {
  return dec(a).minus(dec(b))
}

export function mulMoney(price: Decimalish, qty: Decimalish): Decimal {
  return dec(price).mul(dec(qty))
}

/** Sum a list of decimals. */
export function sumMoney(values: Decimalish[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0))
}

/** Format as INR (₹1,234.50). Rounds half-up to 2 dp via Decimal before formatting. */
export function formatMoney(value: Decimalish | null | undefined): string {
  const rounded = dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  return inr.format(rounded.toNumber())
}

export const formatInr = formatMoney

/** Format a quantity to at most 3 dp, trimming trailing zeros ("1.500" -> "1.5"). */
export function formatQty(value: Decimalish | null | undefined, decimals = 3): string {
  return dec(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed()
}

/** Serialise a quantity for the API: string with max 3 dp. */
export function toApiQty(value: Decimalish): string {
  return dec(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed()
}

/** Serialise a price for the API: string with exactly 2 dp. */
export function toApiMoney(value: Decimalish): string {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
}

export function isBelow(value: Decimalish, threshold: Decimalish): boolean {
  return dec(value).lt(dec(threshold))
}

export function isPositive(value: Decimalish | null | undefined): boolean {
  try {
    return dec(value).gt(0)
  } catch {
    return false
  }
}

/** True if the string is a valid decimal with at most `dp` decimal places. */
export function isValidDecimal(value: string, dp: number): boolean {
  const re = new RegExp(`^\\d+(\\.\\d{1,${dp}})?$`)
  return re.test(value.trim())
}
