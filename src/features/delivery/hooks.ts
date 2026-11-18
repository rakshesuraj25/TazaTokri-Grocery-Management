import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ordersKeys } from '@/features/orders/hooks'
import { deliveryApi } from './api'
import type { DeliverCollectionInput } from './types'

export const deliveryKeys = {
  all: ['delivery'] as const,
  people: () => [...deliveryKeys.all, 'people'] as const,
  history: (orderId: number | string) =>
    [...deliveryKeys.all, 'history', String(orderId)] as const,
  myOrders: () => [...deliveryKeys.all, 'mine'] as const,
}

export function useDeliveryPeople() {
  return useQuery({
    queryKey: deliveryKeys.people(),
    queryFn: () => deliveryApi.listPeople(),
  })
}

export function useOrderDeliveries(orderId?: number | string) {
  return useQuery({
    queryKey: deliveryKeys.history(orderId ?? ''),
    queryFn: () => deliveryApi.listOrderDeliveries(orderId!),
    enabled: orderId !== undefined && orderId !== '',
  })
}

export function useAssignDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      deliveryUserId,
    }: {
      orderId: number | string
      deliveryUserId: number | string
    }) => deliveryApi.assignOrder(orderId, deliveryUserId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveryKeys.all })
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
    },
  })
}

export function useMyDeliveryOrders() {
  return useQuery({
    queryKey: deliveryKeys.myOrders(),
    queryFn: () => deliveryApi.listMyOrders(),
  })
}

export function useStartDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: number | string) => deliveryApi.startDelivery(orderId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveryKeys.all })
    },
  })
}

export function useMarkDelivered() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      body,
    }: {
      orderId: number | string
      body?: DeliverCollectionInput
    }) => deliveryApi.markDelivered(orderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveryKeys.all })
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
    },
  })
}

export function useMarkFailed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number | string; reason: string }) =>
      deliveryApi.markFailed(orderId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveryKeys.all })
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
    },
  })
}
