import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogKeys } from '@/features/catalog/hooks'
import { pricingApi } from './api'
import type { SetPriceRequest } from './types'

export const pricingKeys = {
  all: ['pricing'] as const,
  current: () => [...pricingKeys.all, 'current'] as const,
  history: (vegId: number | string, page = 0) =>
    [...pricingKeys.all, 'history', String(vegId), page] as const,
  suggestion: (vegId: number | string) =>
    [...pricingKeys.all, 'suggestion', String(vegId)] as const,
}

export function useCurrentPrices() {
  return useQuery({
    queryKey: pricingKeys.current(),
    queryFn: () => pricingApi.listCurrentPrices(),
  })
}

export function usePriceHistory(vegId?: number | string, page = 0) {
  return useQuery({
    queryKey: pricingKeys.history(vegId ?? '', page),
    queryFn: () => pricingApi.listPriceHistory(vegId!, page),
    enabled: vegId !== undefined && vegId !== '',
  })
}

export function usePriceSuggestion(vegId?: number | string) {
  return useQuery({
    queryKey: pricingKeys.suggestion(vegId ?? ''),
    queryFn: () => pricingApi.getSuggestion(vegId!),
    enabled: vegId !== undefined && vegId !== '',
    retry: false,
  })
}

export function useSetPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vegId, body }: { vegId: number | string; body: SetPriceRequest }) =>
      pricingApi.setPrice(vegId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pricingKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

export function useApplyPriceSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vegId: number | string) => pricingApi.applySuggestion(vegId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pricingKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}
