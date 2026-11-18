import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogKeys } from '@/features/catalog/hooks'
import { inventoryKeys } from '@/features/inventory/hooks'
import { reportKeys } from '@/features/report/hooks'
import { salesApi } from './api'
import type { CreateSaleRequest } from './types'

export const salesKeys = {
  all: ['sales'] as const,
  byDate: (date: string) => [...salesKeys.all, 'date', date] as const,
  detail: (id: number | string) => [...salesKeys.all, 'detail', String(id)] as const,
}

export function useSalesByDate(date: string) {
  return useQuery({
    queryKey: salesKeys.byDate(date),
    queryFn: () => salesApi.listSalesByDate(date),
    enabled: Boolean(date),
  })
}

export function useSale(id?: number | string) {
  return useQuery({
    queryKey: salesKeys.detail(id ?? ''),
    queryFn: () => salesApi.getSale(id!),
    enabled: id !== undefined && id !== '',
  })
}

export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSaleRequest) => salesApi.createSale(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: salesKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
      void qc.invalidateQueries({ queryKey: inventoryKeys.all })
      void qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}
