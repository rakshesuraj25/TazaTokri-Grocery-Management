import { api } from '@/lib/api'
import type {
  CreatePurchaseRequest,
  CreateSupplierRequest,
  PurchaseResponse,
  PurchaseStatus,
  RecordSupplierPaymentRequest,
  Supplier,
  SupplierDashboardResponse,
  SupplierDetailResponse,
  SupplierPayment,
} from './types'

export interface PurchaseListParams {
  page?: number
  supplierId?: number | string
  from?: string
  to?: string
  status?: PurchaseStatus | ''
  q?: string
}

export const purchaseApi = {
  listSuppliers: (activeOnly = false) =>
    api.get<Supplier[]>(`/api/suppliers?activeOnly=${activeOnly}`),

  /** OWNER only */
  getSupplierDashboard: (q?: string, active?: boolean) => {
    const params = new URLSearchParams()
    if (q && q.trim()) params.set('q', q.trim())
    if (active !== undefined) params.set('active', String(active))
    const qs = params.toString()
    return api.get<SupplierDashboardResponse>(`/api/suppliers/dashboard${qs ? `?${qs}` : ''}`)
  },

  /** OWNER only */
  getSupplierDetail: (id: number | string) =>
    api.get<SupplierDetailResponse>(`/api/suppliers/${id}`),

  createSupplier: (body: CreateSupplierRequest) =>
    api.post<Supplier>('/api/suppliers', body),

  updateSupplier: (id: number | string, body: CreateSupplierRequest) =>
    api.put<Supplier>(`/api/suppliers/${id}`, body),

  updateSupplierStatus: (id: number | string, active: boolean) =>
    api.patch<Supplier>(`/api/suppliers/${id}/status`, { active }),

  recordSupplierPayment: (supplierId: number | string, body: RecordSupplierPaymentRequest) =>
    api.post<SupplierPayment>(`/api/suppliers/${supplierId}/payments`, body),

  createPurchase: (body: CreatePurchaseRequest) =>
    api.post<PurchaseResponse>('/api/purchases', {
      ...body,
      supplierId: Number(body.supplierId),
      items: body.items.map((i) => ({
        vegetableId: Number(i.vegetableId),
        quantity: i.quantity,
        ratePerUnit: i.ratePerUnit,
      })),
    }),

  /** OWNER only */
  listPurchases: (pageOrParams: number | PurchaseListParams = 0) => {
    const p: PurchaseListParams =
      typeof pageOrParams === 'number' ? { page: pageOrParams } : pageOrParams
    const params = new URLSearchParams()
    params.set('page', String(p.page ?? 0))
    if (p.supplierId) params.set('supplierId', String(p.supplierId))
    if (p.from) params.set('from', p.from)
    if (p.to) params.set('to', p.to)
    if (p.status) params.set('status', p.status)
    if (p.q && p.q.trim()) params.set('q', p.q.trim())
    return api.get<PurchaseResponse[]>(`/api/purchases?${params.toString()}`)
  },

  getPurchase: (id: number | string) =>
    api.get<PurchaseResponse>(`/api/purchases/${id}`),

  cancelPurchase: (id: number | string, reason?: string) =>
    api.post<PurchaseResponse>(`/api/purchases/${id}/cancel`, { reason: reason || null }),
}
