import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentsApi } from './api'
import type { SettleCashRequest } from './types'

export const paymentsKeys = {
  all: ['payments'] as const,
  order: (orderId: number | string) =>
    [...paymentsKeys.all, 'order', String(orderId)] as const,
  cashPending: () => [...paymentsKeys.all, 'cash-pending'] as const,
}

export function useOrderPayments(orderId?: number | string) {
  return useQuery({
    queryKey: paymentsKeys.order(orderId ?? ''),
    queryFn: () => paymentsApi.listOrderPayments(orderId!),
    enabled: orderId !== undefined && orderId !== '',
  })
}

export function usePendingCash() {
  return useQuery({
    queryKey: paymentsKeys.cashPending(),
    queryFn: () => paymentsApi.listPendingCash(),
  })
}

export function useSettleCash() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SettleCashRequest) => paymentsApi.settleCash(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentsKeys.all })
    },
  })
}

export function useProcessRefunds() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => paymentsApi.processPendingRefunds(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentsKeys.all })
    },
  })
}
