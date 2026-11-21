import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogKeys } from '@/features/catalog/hooks'
import { inventoryKeys } from '@/features/inventory/hooks'
import { reportKeys } from '@/features/report/hooks'
import { purchaseApi, type PurchaseListParams } from './api'
import type {
  CreatePurchaseRequest,
  CreateSupplierRequest,
  RecordSupplierPaymentRequest,
} from './types'

export const purchaseKeys = {
  all: ['purchase'] as const,
  suppliers: () => [...purchaseKeys.all, 'suppliers'] as const,
  supplierDashboard: (q?: string, active?: boolean) =>
    [...purchaseKeys.all, 'supplier-dashboard', q ?? '', active ?? 'all'] as const,
  supplierDetail: (id: number | string) =>
    [...purchaseKeys.all, 'supplier-detail', String(id)] as const,
  purchases: (params: number | PurchaseListParams = 0) =>
    [...purchaseKeys.all, 'list', typeof params === 'number' ? { page: params } : params] as const,
  purchase: (id: number | string) => [...purchaseKeys.all, 'detail', String(id)] as const,
}

export function useSuppliers(activeOnly = false) {
  return useQuery({
    queryKey: [...purchaseKeys.suppliers(), activeOnly],
    queryFn: () => purchaseApi.listSuppliers(activeOnly),
  })
}

export function useSupplierDashboard(q?: string, active?: boolean, enabled = true) {
  return useQuery({
    queryKey: purchaseKeys.supplierDashboard(q, active),
    queryFn: () => purchaseApi.getSupplierDashboard(q, active),
    enabled,
  })
}

export function useSupplierDetail(id?: number | string) {
  return useQuery({
    queryKey: purchaseKeys.supplierDetail(id ?? ''),
    queryFn: () => purchaseApi.getSupplierDetail(id!),
    enabled: id !== undefined && id !== '',
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSupplierRequest) => purchaseApi.createSupplier(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchaseKeys.all })
    },
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | string; body: CreateSupplierRequest }) =>
      purchaseApi.updateSupplier(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchaseKeys.all })
    },
  })
}

export function useUpdateSupplierStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: number | string; active: boolean }) =>
      purchaseApi.updateSupplierStatus(id, active),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchaseKeys.all })
    },
  })
}

export function useRecordSupplierPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      supplierId,
      body,
    }: {
      supplierId: number | string
      body: RecordSupplierPaymentRequest
    }) => purchaseApi.recordSupplierPayment(supplierId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchaseKeys.all })
      void qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}

export function usePurchases(pageOrParams: number | PurchaseListParams = 0, enabled = true) {
  return useQuery({
    queryKey: purchaseKeys.purchases(pageOrParams),
    queryFn: () => purchaseApi.listPurchases(pageOrParams),
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

export function useCancelPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason?: string }) =>
      purchaseApi.cancelPurchase(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchaseKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
      void qc.invalidateQueries({ queryKey: inventoryKeys.all })
      void qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}
