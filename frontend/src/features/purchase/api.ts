import { api } from '@/lib/api'
import type {
  CreatePurchaseRequest,
  CreateSupplierRequest,
  PurchaseResponse,
  Supplier,
} from './types'

export const purchaseApi = {
  listSuppliers: () => api.get<Supplier[]>('/api/suppliers'),
  createSupplier: (body: CreateSupplierRequest) => api.post<Supplier>('/api/suppliers', body),

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
  listPurchases: (page = 0) => api.get<PurchaseResponse[]>(`/api/purchases?page=${page}`),
  getPurchase: (id: number | string) => api.get<PurchaseResponse>(`/api/purchases/${id}`),
}
