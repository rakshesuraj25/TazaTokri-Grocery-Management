import { api } from '@/lib/api'
import type { DailyReportResponse } from './types'

export const reportApi = {
  /** OWNER only */
  getDailyReport: (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : ''
    return api.get<DailyReportResponse>(`/api/reports/daily${qs}`)
  },
}
