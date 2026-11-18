import { api } from '@/lib/api'
import type { CreateSaleRequest, SaleResponse } from './types'

export const salesApi = {
  createSale: (body: CreateSaleRequest) =>
    api.post<SaleResponse>('/api/sales', {
      ...body,
      items: body.items.map((item) => ({
        vegetableId: Number(item.vegetableId),
        quantity: item.quantity,
      })),
    }),

  listSalesByDate: (date: string) =>
    api.get<SaleResponse[]>(`/api/sales?date=${encodeURIComponent(date)}`),

  getSale: (id: number | string) => api.get<SaleResponse>(`/api/sales/${id}`),
}
