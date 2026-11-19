import { describe, expect, it } from 'vitest'
import {
  MIN_ORDER_AMOUNT,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  DELIVERY_CUTOFF_HOUR,
  estimateDeliveryFee,
  isMinimumOrderMet,
  isLowStock,
  isOutOfStock,
  getStockStatus,
} from '@/lib/businessRules'
import { dec } from '@/lib/money'

describe('Phase 5 — Production Launch Readiness: Business Rules, Boundaries & Integrity', () => {
  it('Task 3: validates exact boundary conditions for minimum order & delivery fee', () => {
    // 1. Minimum order boundary (threshold: ₹150)
    expect(isMinimumOrderMet(149)).toBe(false)
    expect(isMinimumOrderMet(149.99)).toBe(false)
    expect(isMinimumOrderMet(150)).toBe(true)
    expect(isMinimumOrderMet(150.01)).toBe(true)

    // 2. Free delivery boundary (threshold: ₹300, fee: ₹30)
    expect(estimateDeliveryFee(0).toNumber()).toBe(0)
    expect(estimateDeliveryFee(149).toNumber()).toBe(DELIVERY_FEE)
    expect(estimateDeliveryFee(150).toNumber()).toBe(DELIVERY_FEE)
    expect(estimateDeliveryFee(299).toNumber()).toBe(DELIVERY_FEE)
    expect(estimateDeliveryFee(299.99).toNumber()).toBe(DELIVERY_FEE)
    expect(estimateDeliveryFee(300).toNumber()).toBe(0)
    expect(estimateDeliveryFee(300.01).toNumber()).toBe(0)
    expect(estimateDeliveryFee(500).toNumber()).toBe(0)

    // Constants verification
    expect(MIN_ORDER_AMOUNT).toBe(150)
    expect(DELIVERY_FEE).toBe(30)
    expect(FREE_DELIVERY_THRESHOLD).toBe(300)
    expect(DELIVERY_CUTOFF_HOUR).toBe(18) // 6 PM IST
  })

  it('Task 2 & 5: stock boundary checks prevent false availability and correctly categorize stock levels', () => {
    // Out of stock
    expect(isOutOfStock(0)).toBe(true)
    expect(isOutOfStock(-1)).toBe(true)
    expect(isOutOfStock(0.001)).toBe(false)

    // Low stock thresholds for KG (5 kg)
    expect(isLowStock(5.000, 'KG')).toBe(true)
    expect(isLowStock(5.001, 'KG')).toBe(false)
    expect(isLowStock(0, 'KG')).toBe(false) // 0 is OUT_OF_STOCK, not LOW_STOCK

    // Categorization
    expect(getStockStatus(0, 'KG')).toBe('OUT_OF_STOCK')
    expect(getStockStatus(3.5, 'KG')).toBe('LOW_STOCK')
    expect(getStockStatus(12.0, 'KG')).toBe('IN_STOCK')
  })

  it('Task 3: decimal currency arithmetic maintains exact precision without floating point drift', () => {
    const item1 = dec('40.00').mul('2.500') // 100.00
    const item2 = dec('35.50').mul('1.500') // 53.25
    const subtotal = item1.add(item2) // 153.25
    const fee = estimateDeliveryFee(subtotal) // 30.00 (subtotal < 300)
    const total = subtotal.add(fee) // 183.25

    expect(subtotal.toFixed(2)).toBe('153.25')
    expect(fee.toFixed(2)).toBe('30.00')
    expect(total.toFixed(2)).toBe('183.25')
    expect(isMinimumOrderMet(subtotal)).toBe(true)
  })
})
