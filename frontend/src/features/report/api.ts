import { api } from '@/lib/api'
import type {
  BusinessIntelligenceReportResponse,
  DailyReportResponse,
  OperationalHealthResponse,
  WastageReportResponse,
} from './types'

export const reportApi = {
  /** OWNER only */
  getDailyReport: (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : ''
    return api.get<DailyReportResponse>(`/api/reports/daily${qs}`)
  },

  /** OWNER and STAFF — Daily & weekly wastage report with actual purchase landed cost */
  getWastageReport: (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : ''
    return api.get<WastageReportResponse>(`/api/reports/wastage${qs}`)
  },

  /** OWNER and STAFF — Inventory valuation, stock movement, sales performance, profitability & freshness batches */
  getBusinessIntelligence: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return api.get<BusinessIntelligenceReportResponse>(`/api/reports/intelligence${qs}`)
  },

  /** OWNER and STAFF — Operational health, database connectivity, backup status & provider flags */
  getOperationalHealth: () => api.get<OperationalHealthResponse>('/api/ops/health'),
}
