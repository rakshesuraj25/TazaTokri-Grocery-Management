import { useQuery } from '@tanstack/react-query'
import { reportApi } from './api'

export const reportKeys = {
  all: ['report'] as const,
  daily: (date?: string) => [...reportKeys.all, 'daily', date ?? 'today'] as const,
}

export function useDailyReport(date?: string) {
  return useQuery({
    queryKey: reportKeys.daily(date),
    queryFn: () => reportApi.getDailyReport(date),
  })
}
