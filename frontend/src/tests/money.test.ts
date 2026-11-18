import { describe, expect, it } from 'vitest'
import {
  addMoney,
  formatMoney,
  formatQty,
  fromPaise,
  isBelow,
  isValidDecimal,
  mulMoney,
  subMoney,
  sumMoney,
  toApiMoney,
  toApiQty,
  toPaise,
} from '@/lib/money'
import {
  DELIVERY_CUTOFF_HOUR,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  MIN_ORDER_AMOUNT,
  ONLINE_ORDER_EXPIRY_MINUTES,
  estimateDeliveryFee,
  isMinimumOrderMet,
  isSameDayDeliveryIST,
} from '@/lib/businessRules'

describe('money & quantity decimal helpers', () => {
  it('converts string and numeric amounts to integer paise without float drift', () => {
    expect(toPaise('19.99')).toBe(1999)
    expect(toPaise(150.5)).toBe(15050)
    expect(fromPaise(15050).toFixed(2)).toBe('150.50')
  })

  it('adds, subtracts, multiplies and sums decimal strings accurately', () => {
    expect(addMoney('0.1', '0.2').toFixed(2)).toBe('0.30')
    expect(subMoney('150.00', '49.25').toFixed(2)).toBe('100.75')
    expect(mulMoney('40.00', '0.250').toFixed(2)).toBe('10.00')
    expect(sumMoney(['10.50', '20.25', 5]).toFixed(2)).toBe('35.75')
  })

  it('formats INR currency and trims quantity trailing zeros up to 3 decimals', () => {
    expect(formatMoney('1234.5')).toContain('1,234.50')
    expect(formatQty('1.500')).toBe('1.5')
    expect(formatQty('0.250')).toBe('0.25')
    expect(toApiQty('1.2500')).toBe('1.25')
    expect(toApiMoney('42.5')).toBe('42.50')
  })

  it('validates decimal precision and threshold checks', () => {
    expect(isBelow('149.99', 150)).toBe(true)
    expect(isBelow('150.00', 150)).toBe(false)
    expect(isValidDecimal('12.345', 3)).toBe(true)
    expect(isValidDecimal('12.3456', 3)).toBe(false)
  })
})

describe('business rules (fee, minimum order, and 18:00 IST cutoff)', () => {
  it('exposes the authoritative display constants', () => {
    expect(MIN_ORDER_AMOUNT).toBe(150)
    expect(DELIVERY_FEE).toBe(30)
    expect(FREE_DELIVERY_THRESHOLD).toBe(300)
    expect(DELIVERY_CUTOFF_HOUR).toBe(18)
    expect(ONLINE_ORDER_EXPIRY_MINUTES).toBe(15)
  })

  it('computes delivery fee: Rs 30 under 300, Rs 0 at 300 and above', () => {
    expect(estimateDeliveryFee('0').toFixed(2)).toBe('0.00')
    expect(estimateDeliveryFee('150.00').toFixed(2)).toBe('30.00')
    expect(estimateDeliveryFee('299.99').toFixed(2)).toBe('30.00')
    expect(estimateDeliveryFee('300.00').toFixed(2)).toBe('0.00')
    expect(estimateDeliveryFee('300.01').toFixed(2)).toBe('0.00')
    expect(estimateDeliveryFee('450.00').toFixed(2)).toBe('0.00')
  })

  it('rejects orders under Rs 150 and accepts Rs 150 and above', () => {
    expect(isMinimumOrderMet('0')).toBe(false)
    expect(isMinimumOrderMet('149.99')).toBe(false)
    expect(isMinimumOrderMet('150.00')).toBe(true)
    expect(isMinimumOrderMet('250.00')).toBe(true)
  })

  it('enforces the 18:00 IST cutoff boundary (17:59 = today, 18:00 = tomorrow)', () => {
    // 17:59 IST = 12:29 UTC
    const beforeCutoff = new Date('2026-11-14T17:59:00+05:30')
    // 18:00 IST = 12:30 UTC
    const atCutoff = new Date('2026-11-14T18:00:00+05:30')
    const afterCutoff = new Date('2026-11-14T19:15:00+05:30')

    expect(isSameDayDeliveryIST(beforeCutoff)).toBe(true)
    expect(isSameDayDeliveryIST(atCutoff)).toBe(false)
    expect(isSameDayDeliveryIST(afterCutoff)).toBe(false)
  })
})
