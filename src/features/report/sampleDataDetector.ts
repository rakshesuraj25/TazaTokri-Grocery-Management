import type { CurrentPriceItem } from '@/features/pricing/types'
import { dec, type Decimalish } from '@/lib/money'

export interface SampleDataDetection {
  isFlagged: boolean
  reasons: string[]
  samplePriceItems: CurrentPriceItem[]
}

/**
 * Conservative sample-data detector:
 * 1. Any current price with note matching "Sample price - replace".
 * 2. Active prices present while daily purchase spend is <= 0.
 */
export function detectSampleData(
  currentPrices: CurrentPriceItem[],
  purchaseSpend: Decimalish | null | undefined,
): SampleDataDetection {
  const samplePriceItems = currentPrices.filter((p) =>
    (p.note ?? '').toLowerCase().includes('sample price'),
  )
  const reasons: string[] = []

  if (samplePriceItems.length > 0) {
    reasons.push(
      `${samplePriceItems.length} vegetable price(s) have the note "Sample price - replace".`,
    )
  }

  if (currentPrices.length > 0 && dec(purchaseSpend).lte(0)) {
    reasons.push(
      'Selling prices are active, but no mandi purchases are recorded for the selected date.',
    )
  }

  return {
    isFlagged: reasons.length > 0,
    reasons,
    samplePriceItems,
  }
}
