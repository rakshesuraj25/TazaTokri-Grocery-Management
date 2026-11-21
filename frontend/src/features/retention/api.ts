import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CustomerSegment = 'NEW' | 'REPEAT' | 'HIGH_VALUE' | 'INACTIVE' | 'ACTIVE'
export type PromoDiscountType = 'PERCENTAGE' | 'FIXED'

export interface CustomerInsight {
  customerId: number
  fullName: string
  phone: string
  totalOrders: number
  totalSpend: number
  averageOrderValue: number
  lastOrderDate: string | null
  daysSinceLastOrder: number | null
  loyaltyBalance: number
  segment: CustomerSegment
}

export interface RetentionDashboard {
  from: string
  to: string
  inactiveDaysThreshold: number
  highValueThreshold: number
  totalCustomers: number
  newCustomersInPeriod: number
  repeatCustomers: number
  repeatPurchaseRate: number
  inactiveCustomers: number
  highValueCustomers: number
  averageOrderFrequency: number
  averageLifetimeSpend: number
  totalMatchingCustomers: number
  page: number
  size: number
  customers: CustomerInsight[]
}

export interface PromoOffer {
  id: number
  name: string
  code: string
  description: string | null
  discountType: PromoDiscountType
  discountValue: number
  minOrderAmount: number
  maxDiscountAmount: number | null
  startsAt: string
  expiresAt: string
  maxTotalUses: number | null
  maxUsesPerCustomer: number
  enabled: boolean
  totalUsed: number
}

export interface PromoOfferPayload {
  name: string
  code: string
  description?: string
  discountType: PromoDiscountType
  discountValue: number
  minOrderAmount: number
  maxDiscountAmount: number | null
  startsAt: string
  expiresAt: string
  maxTotalUses: number | null
  maxUsesPerCustomer: number
  enabled: boolean
}

export interface PromoPreview {
  code: string
  discountType: PromoDiscountType
  discountValue: number
  discountAmount: number
  description: string | null
}

export const retentionKeys = {
  insights: (params: Record<string, string | number | undefined>) =>
    ['owner', 'retention', params] as const,
  promos: ['owner', 'promos'] as const,
}

export const retentionApi = {
  getInsights: (params: {
    from: string
    to: string
    inactiveDays?: number
    segment?: CustomerSegment
    search?: string
    sortBy?: string
    page?: number
    size?: number
  }) => {
    const qs = new URLSearchParams()
    qs.set('from', params.from)
    qs.set('to', params.to)
    if (params.inactiveDays !== undefined) qs.set('inactiveDays', String(params.inactiveDays))
    if (params.segment) qs.set('segment', params.segment)
    if (params.search?.trim()) qs.set('search', params.search.trim())
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.page !== undefined) qs.set('page', String(params.page))
    if (params.size !== undefined) qs.set('size', String(params.size))
    return api.get<RetentionDashboard>(`/api/owner/retention/insights?${qs.toString()}`)
  },
  listPromos: () => api.get<PromoOffer[]>('/api/owner/promos'),
  createPromo: (body: PromoOfferPayload) => api.post<PromoOffer>('/api/owner/promos', body),
  updatePromo: (id: number, body: PromoOfferPayload) =>
    api.put<PromoOffer>(`/api/owner/promos/${id}`, body),
  togglePromo: (id: number, enabled: boolean) =>
    api.patch<PromoOffer>(`/api/owner/promos/${id}/status`, { enabled }),
  validatePromo: (code: string, subtotal: number, loyaltyDiscount = 0) =>
    api.get<PromoPreview>(
      `/api/promos/validate?code=${encodeURIComponent(code)}&subtotal=${subtotal}&loyaltyDiscount=${loyaltyDiscount}`,
    ),
}

export function useRetentionInsights(params: {
  from: string
  to: string
  inactiveDays?: number
  segment?: CustomerSegment
  search?: string
  sortBy?: string
  page?: number
  size?: number
}) {
  return useQuery({
    queryKey: retentionKeys.insights(params),
    queryFn: () => retentionApi.getInsights(params),
    enabled: Boolean(params.from && params.to),
  })
}

export function useOwnerPromos() {
  return useQuery({
    queryKey: retentionKeys.promos,
    queryFn: () => retentionApi.listPromos(),
  })
}

export function useCreatePromo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PromoOfferPayload) => retentionApi.createPromo(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: retentionKeys.promos }),
  })
}

export function useUpdatePromo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PromoOfferPayload }) =>
      retentionApi.updatePromo(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: retentionKeys.promos }),
  })
}

export function useTogglePromo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      retentionApi.togglePromo(id, enabled),
    onSuccess: () => void qc.invalidateQueries({ queryKey: retentionKeys.promos }),
  })
}
