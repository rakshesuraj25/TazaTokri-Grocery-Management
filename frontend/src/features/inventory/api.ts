import { api } from '@/lib/api'
import type {
  RecordAdjustmentRequest,
  RecordWastageRequest,
  StockMovement,
  StockSummary,
} from './types'

export const inventoryApi = {
  getStock: (vegetableId: number | string) =>
    api.get<StockSummary>(`/api/inventory/stock/${vegetableId}`),

  getMovements: (vegetableId: number | string, page = 0) =>
    api.get<StockMovement[]>(`/api/inventory/stock/${vegetableId}/movements?page=${page}`),

  recordWastage: (body: RecordWastageRequest) =>
    api.post<unknown>('/api/inventory/wastage', {
      ...body,
      vegetableId: Number(body.vegetableId),
    }),

  /** OWNER only — append-only ledger adjustment */
  recordAdjustment: (body: RecordAdjustmentRequest) =>
    api.post<unknown>('/api/inventory/adjustments', {
      ...body,
      vegetableId: Number(body.vegetableId),
    }),
}
