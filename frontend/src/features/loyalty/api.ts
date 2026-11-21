import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type LoyaltyTransactionType = 'EARN' | 'REDEEM' | 'REFUND_REVERSAL' | 'EXPIRY'

export interface LoyaltySettings {
  enabled: boolean
  pointsPer100Inr: number
  rupeesPerPoint: number
  minRedeemPoints: number
  maxRedeemPointsPerOrder: number
  expiryDays: number | null
}

export interface LoyaltyTx {
  id: number
  orderId: number | null
  type: LoyaltyTransactionType
  points: number
  rupeeValue: number
  description: string | null
  expiresAt: string | null
  createdAt: string
}

export interface CustomerLoyaltySummary {
  enabled: boolean
  balance: number
  pointsPer100Inr: number
  rupeesPerPoint: number
  minRedeemPoints: number
  maxRedeemPointsPerOrder: number
  expiryDays: number | null
  transactions: LoyaltyTx[]
}

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: false,
  pointsPer100Inr: 5,
  rupeesPerPoint: 1,
  minRedeemPoints: 50,
  maxRedeemPointsPerOrder: 200,
  expiryDays: null,
}

export const loyaltyKeys = {
  publicSettings: ['public', 'loyalty', 'settings'] as const,
  my: ['my', 'loyalty'] as const,
  ownerSettings: ['owner', 'loyalty', 'settings'] as const,
}

export const loyaltyApi = {
  getPublicSettings: () => api.get<LoyaltySettings>('/api/loyalty/settings'),
  getMyLoyalty: () => api.get<CustomerLoyaltySummary>('/api/my/loyalty'),
  getOwnerSettings: () => api.get<LoyaltySettings>('/api/owner/loyalty/settings'),
  updateOwnerSettings: (body: LoyaltySettings) =>
    api.put<LoyaltySettings>('/api/owner/loyalty/settings', body),
}

export function usePublicLoyaltySettings() {
  const q = useQuery({
    queryKey: loyaltyKeys.publicSettings,
    queryFn: () => loyaltyApi.getPublicSettings(),
    staleTime: 60_000,
    retry: false,
  })
  return { ...q, settings: q.data ?? DEFAULT_LOYALTY_SETTINGS }
}

export function useMyLoyalty(enabled = true) {
  return useQuery({
    queryKey: loyaltyKeys.my,
    queryFn: () => loyaltyApi.getMyLoyalty(),
    enabled,
    retry: false,
  })
}

export function useOwnerLoyaltySettings() {
  return useQuery({
    queryKey: loyaltyKeys.ownerSettings,
    queryFn: () => loyaltyApi.getOwnerSettings(),
  })
}

export function useUpdateOwnerLoyaltySettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LoyaltySettings) => loyaltyApi.updateOwnerSettings(body),
    onSuccess: (updated) => {
      qc.setQueryData(loyaltyKeys.ownerSettings, updated)
      qc.setQueryData(loyaltyKeys.publicSettings, updated)
    },
  })
}
