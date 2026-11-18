import { api } from '@/lib/api'
import type { CurrentPriceItem, PriceSuggestion, SetPriceRequest } from './types'

export const pricingApi = {
  listCurrentPrices: () => api.get<CurrentPriceItem[]>('/api/pricing/current'),

  setPrice: (vegetableId: number | string, body: SetPriceRequest) =>
    api.put<CurrentPriceItem>(`/api/pricing/vegetables/${vegetableId}`, body),

  listPriceHistory: (vegetableId: number | string, page = 0) =>
    api.get<CurrentPriceItem[]>(`/api/pricing/vegetables/${vegetableId}/history?page=${page}`),

  /** OWNER only — returns 400 if no recent purchases */
  getSuggestion: (vegetableId: number | string) =>
    api.get<PriceSuggestion>(`/api/pricing/vegetables/${vegetableId}/suggestion`),

  /** OWNER only */
  applySuggestion: (vegetableId: number | string) =>
    api.post<CurrentPriceItem>(`/api/pricing/vegetables/${vegetableId}/apply-suggestion`),
}
