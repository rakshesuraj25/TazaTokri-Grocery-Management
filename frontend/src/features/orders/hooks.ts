import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogKeys } from '@/features/catalog/hooks'
import { inventoryKeys } from '@/features/inventory/hooks'
import { ordersApi } from './api'
import type {
  OrderStatus,
  PackOrderRequest,
  PlaceOrderRequest,
  VerifyPaymentRequest,
} from './types'

export const ordersKeys = {
  all: ['orders'] as const,
  customerList: (page = 0) => [...ordersKeys.all, 'customer', page] as const,
  customerDetail: (id: number | string) =>
    [...ordersKeys.all, 'customer', 'detail', String(id)] as const,
  staffList: (date?: string, status?: OrderStatus) =>
    [...ordersKeys.all, 'staff', date ?? '', status ?? ''] as const,
  staffDetail: (id: number | string) =>
    [...ordersKeys.all, 'staff', 'detail', String(id)] as const,
}

export function useCustomerOrders(page = 0, enabled = true) {
  return useQuery({
    queryKey: ordersKeys.customerList(page),
    queryFn: () => ordersApi.listCustomerOrders(page),
    enabled,
  })
}

export function useCustomerOrder(id?: number | string, refetchInterval?: number | false) {
  return useQuery({
    queryKey: ordersKeys.customerDetail(id ?? ''),
    queryFn: () => ordersApi.getCustomerOrder(id!),
    enabled: id !== undefined && id !== '',
    refetchInterval,
  })
}

export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PlaceOrderRequest) => ordersApi.placeCustomerOrder(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

export function useCancelCustomerOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason?: string }) =>
      ordersApi.cancelCustomerOrder(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

export function useStartOnlinePayment() {
  return useMutation({
    mutationFn: (orderId: number | string) => ordersApi.startOnlinePayment(orderId),
  })
}

export function useVerifyOnlinePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, body }: { orderId: number | string; body: VerifyPaymentRequest }) =>
      ordersApi.verifyOnlinePayment(orderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
    },
  })
}

export function useStaffOrders(params: { date?: string; status?: OrderStatus } = {}) {
  return useQuery({
    queryKey: ordersKeys.staffList(params.date, params.status),
    queryFn: () => ordersApi.listStaffOrders(params),
  })
}

export function useStaffOrder(id?: number | string) {
  return useQuery({
    queryKey: ordersKeys.staffDetail(id ?? ''),
    queryFn: () => ordersApi.getStaffOrder(id!),
    enabled: id !== undefined && id !== '',
  })
}

export function useConfirmOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => ordersApi.confirmOrder(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
    },
  })
}

export function usePackOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | string; body: PackOrderRequest }) =>
      ordersApi.packOrder(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
      void qc.invalidateQueries({ queryKey: inventoryKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

export function useCancelStaffOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason: string }) =>
      ordersApi.cancelStaffOrder(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
      void qc.invalidateQueries({ queryKey: inventoryKeys.all })
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}
