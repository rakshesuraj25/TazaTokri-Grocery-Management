import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogKeys } from '@/features/catalog/hooks'
import { inventoryKeys } from '@/features/inventory/hooks'
import { reportKeys } from '@/features/report/hooks'
import { purchaseApi } from './api'
import type { CreatePurchaseRequest, CreateSupplierRequest } from './types'

export const purchaseKeys = {
  all: ['purchase'] as const,
  suppliers: () => [...purchaseKeys.all, 'suppliers'] as const,
  purchases: (page = 0) => [...purchaseKeys.all, 'list', page] as const,
  purchase: (id: number | string) => [...purchaseKeys.all, 'detail', String(id)] as const,
}

export function useSuppliers() {
  return useQuery({
    queryKey: purchaseKeys.suppliers(),
    queryFn: () => purchaseApi.listSuppliers(),
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSupplierRequest) => purchaseApi.createSupplier(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchaseKeys.suppliers() })
    },
  })
}

export function usePurchases(page = 0, enabled = true) {
  return useQuery({
    queryKey: purchaseKeys.purchases(page),
    queryFn: () => purchaseApi.listPurchases(page),
    enabled,
  })
}

export function usePurchase(id?: number | string) {
  return useQuery({
    queryKey: purchaseKeys.purchase(id ?? ''),
    queryFn: () => purchaseApi.getPurchase(id!),
    enabled: id !== undefined && id !== '',
  })
}

export function useCreatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreatePurchaseRequest) => purchaseApi.createPurchase(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchaseKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
      void qc.invalidateQueries({ queryKey: inventoryKeys.all })
      void qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}
