import { useQuery } from '@tanstack/react-query'
import { reportApi } from './api'

export const reportKeys = {
  all: ['report'] as const,
  daily: (date?: string) => [...reportKeys.all, 'daily', date ?? 'today'] as const,
  wastage: (date?: string) => [...reportKeys.all, 'wastage', date ?? 'today'] as const,
  intelligence: (from?: string, to?: string) =>
    [...reportKeys.all, 'intelligence', from ?? 'default', to ?? 'today'] as const,
  opsHealth: () => [...reportKeys.all, 'ops-health'] as const,
}

export function useDailyReport(date?: string) {
  return useQuery({
    queryKey: reportKeys.daily(date),
    queryFn: () => reportApi.getDailyReport(date),
  })
}

export function useWastageReport(date?: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.wastage(date),
    queryFn: () => reportApi.getWastageReport(date),
    enabled,
  })
}

export function useBusinessIntelligenceReport(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.intelligence(from, to),
    queryFn: () => reportApi.getBusinessIntelligence(from, to),
    enabled,
  })
}

export function useOperationalHealth(enabled = true) {
  return useQuery({
    queryKey: reportKeys.opsHealth(),
    queryFn: () => reportApi.getOperationalHealth(),
    enabled,
    staleTime: 30_000,
  })
}
