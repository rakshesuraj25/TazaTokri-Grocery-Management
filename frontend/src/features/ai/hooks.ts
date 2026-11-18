import { useMutation, useQuery } from '@tanstack/react-query'
import { aiApi } from './api'

export const aiKeys = {
  all: ['ai'] as const,
  status: () => [...aiKeys.all, 'status'] as const,
}

export function useAiStatus(enabled = true) {
  return useQuery({
    queryKey: aiKeys.status(),
    queryFn: () => aiApi.getStatus(),
    enabled,
    staleTime: 60_000,
  })
}

export function useExtractPurchaseInvoice() {
  return useMutation({
    mutationFn: (input: { file?: File | null; rawText?: string }) =>
      aiApi.extractPurchaseInvoice(input),
  })
}

export function useExtractQuickSaleList() {
  return useMutation({
    mutationFn: (input: { file?: File | null; rawText?: string }) =>
      aiApi.extractQuickSaleList(input),
  })
}
