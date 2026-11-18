import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ordersKeys } from '@/features/orders/hooks'
import { deliveryApi } from './api'
import type { DeliverCollectionInput } from './types'

export const deliveryKeys = {
  all: ['delivery'] as const,
  people: () => [...deliveryKeys.all, 'people'] as const,
  board: (params?: {
    date?: string
    stage?: string
    pincode?: string
    deliveryUserId?: number | string
  }) =>
    [
      ...deliveryKeys.all,
      'board',
      params?.date ?? 'today',
      params?.stage ?? 'ALL',
      params?.pincode ?? 'ALL',
      String(params?.deliveryUserId ?? 'ALL'),
    ] as const,
  history: (orderId: number | string) =>
    [...deliveryKeys.all, 'history', String(orderId)] as const,
  audit: (orderId: number | string) =>
    [...deliveryKeys.all, 'audit', String(orderId)] as const,
  evidence: (orderId: number | string) =>
    [...deliveryKeys.all, 'evidence', String(orderId)] as const,
  myOrders: () => [...deliveryKeys.all, 'mine'] as const,
}

export function useDeliveryPeople() {
  return useQuery({
    queryKey: deliveryKeys.people(),
    queryFn: () => deliveryApi.listPeople(),
  })
}

export function useStaffDeliveryBoard(
  params?: {
    date?: string
    stage?: string
    pincode?: string
    deliveryUserId?: number | string
  },
  enabled = true,
) {
  return useQuery({
    queryKey: deliveryKeys.board(params),
    queryFn: () => deliveryApi.getStaffBoard(params),
    enabled,
  })
}

export function useOrderDeliveries(orderId?: number | string) {
  return useQuery({
    queryKey: deliveryKeys.history(orderId ?? ''),
    queryFn: () => deliveryApi.listOrderDeliveries(orderId!),
    enabled: orderId !== undefined && orderId !== '',
  })
}

export function useOrderDeliveryAudit(orderId?: number | string, enabled = true) {
  return useQuery({
    queryKey: deliveryKeys.audit(orderId ?? ''),
    queryFn: () => deliveryApi.listOrderAuditTrail(orderId!),
    enabled: enabled && orderId !== undefined && orderId !== '',
  })
}

export function useOrderDeliveryEvidences(orderId?: number | string, enabled = true) {
  return useQuery({
    queryKey: deliveryKeys.evidence(orderId ?? ''),
    queryFn: () => deliveryApi.listOrderEvidences(orderId!),
    enabled: enabled && orderId !== undefined && orderId !== '',
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

export function useReturnDeliveryToStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: number | string; note?: string }) =>
      deliveryApi.returnToStore(orderId, note),
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

export function useIssueDeliveryOtp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: number | string) => deliveryApi.issueOtp(orderId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveryKeys.all })
    },
  })
}

export function useVerifyDeliveryOtp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, otp }: { orderId: number | string; otp: string }) =>
      deliveryApi.verifyOtp(orderId, otp),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveryKeys.all })
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
    },
  })
}

export function useManualOtpOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number | string; reason: string }) =>
      deliveryApi.manualOtpOverride(orderId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveryKeys.all })
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
    },
  })
}

export function useUploadDeliveryProof() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      file,
      note,
    }: {
      orderId: number | string
      file: File
      note?: string
    }) => deliveryApi.uploadProofPhoto(orderId, file, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveryKeys.all })
      void qc.invalidateQueries({ queryKey: ordersKeys.all })
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
