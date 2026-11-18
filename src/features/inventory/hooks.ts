import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogKeys } from '@/features/catalog/hooks'
import { reportKeys } from '@/features/report/hooks'
import { inventoryApi } from './api'
import type { RecordAdjustmentRequest, RecordWastageRequest } from './types'

export const inventoryKeys = {
  all: ['inventory'] as const,
  stock: (vegetableId: number | string) =>
    [...inventoryKeys.all, 'stock', String(vegetableId)] as const,
  movements: (vegetableId: number | string, page = 0) =>
    [...inventoryKeys.all, 'movements', String(vegetableId), page] as const,
}

export function useStock(vegetableId?: number | string) {
  return useQuery({
    queryKey: inventoryKeys.stock(vegetableId ?? ''),
    queryFn: () => inventoryApi.getStock(vegetableId!),
    enabled: vegetableId !== undefined && vegetableId !== '',
  })
}

export function useStockMovements(vegetableId?: number | string, page = 0) {
  return useQuery({
    queryKey: inventoryKeys.movements(vegetableId ?? '', page),
    queryFn: () => inventoryApi.getMovements(vegetableId!, page),
    enabled: vegetableId !== undefined && vegetableId !== '',
  })
}

export function useRecordWastage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RecordWastageRequest) => inventoryApi.recordWastage(body),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: inventoryKeys.stock(vars.vegetableId) })
      void qc.invalidateQueries({ queryKey: inventoryKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
      void qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}

export function useRecordAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RecordAdjustmentRequest) => inventoryApi.recordAdjustment(body),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: inventoryKeys.stock(vars.vegetableId) })
      void qc.invalidateQueries({ queryKey: inventoryKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
      void qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}
