import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface RiderSummary {
  userId: number
  fullName: string
  phone: string
  active: boolean
  assignedCount: number
  outForDeliveryCount: number
  deliveredCount: number
  failedCount: number
  completionRate: number
  codCollectedTotal: number
  codSettledTotal: number
  codPendingSettlement: number
}

export interface RiderDeliveryAttempt {
  id: number
  orderId: number
  deliveryUserId: number
  status: 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED'
  assignedAt: string
  startedAt: string | null
  finishedAt: string | null
  failureReason: string | null
  otpVerified: boolean
}

export const riderOpsKeys = {
  summary: ['delivery', 'riders', 'summary'] as const,
  history: (id: number) => ['delivery', 'riders', id, 'history'] as const,
}

export const riderOpsApi = {
  getSummary: () => api.get<RiderSummary[]>('/api/delivery/riders/summary'),
  getHistory: (id: number) => api.get<RiderDeliveryAttempt[]>(`/api/delivery/riders/${id}/history`),
}

export function useRiderSummary() {
  return useQuery({
    queryKey: riderOpsKeys.summary,
    queryFn: () => riderOpsApi.getSummary(),
  })
}

export function useRiderHistory(riderId: number | null) {
  return useQuery({
    queryKey: riderId ? riderOpsKeys.history(riderId) : ['delivery', 'riders', 'none'],
    queryFn: () => riderOpsApi.getHistory(riderId!),
    enabled: riderId !== null,
  })
}
