import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface DailyCashTally {
  date: string
  status: 'OPEN' | 'CLOSED'
  openingCash: number
  suggestedOpeningCash: number
  shopCashSales: number
  shopCashBills: number
  posUpiSales: number
  posUpiBills: number
  codCashCollected: number
  codCashBills: number
  codCashSettledToShop: number
  codCashPendingSettlement: number
  deliveryUpiCollections: number
  razorpayCollections: number
  cashRefunds: number
  digitalRefunds: number
  purchaseSpend: number
  cashExpenses: number
  expenseNote: string | null
  expectedCash: number
  actualCashCounted: number | null
  difference: number | null
  note: string | null
  closedBy: string | null
  closedAt: string | null
  hasTransactions: boolean
}

export interface CloseDayPayload {
  date: string
  openingCash: number
  cashExpenses: number
  expenseNote?: string
  actualCashCounted: number
  note?: string
}

export interface ClosedCashRecord {
  date: string
  openingCash: number
  shopCashSales: number
  codCashSettledToShop: number
  cashExpenses: number
  expenseNote: string | null
  cashRefunds: number
  expectedCash: number
  actualCashCounted: number
  difference: number
  note: string | null
  closedBy: string
  closedAt: string
}

export const cashClosingKeys = {
  tally: (date: string) => ['owner', 'cash-closing', date] as const,
  history: ['owner', 'cash-closing', 'history'] as const,
}

export const cashClosingApi = {
  getTally: (date: string) =>
    api.get<DailyCashTally>(`/api/owner/cash-closing?date=${encodeURIComponent(date)}`),
  getHistory: () => api.get<ClosedCashRecord[]>('/api/owner/cash-closing/history'),
  closeDay: (body: CloseDayPayload) =>
    api.post<DailyCashTally>('/api/owner/cash-closing', body),
}

export function useDailyCashTally(date: string) {
  return useQuery({
    queryKey: cashClosingKeys.tally(date),
    queryFn: () => cashClosingApi.getTally(date),
    enabled: Boolean(date),
  })
}

export function useCashClosingHistory() {
  return useQuery({
    queryKey: cashClosingKeys.history,
    queryFn: () => cashClosingApi.getHistory(),
  })
}

export function useCloseCashDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CloseDayPayload) => cashClosingApi.closeDay(body),
    onSuccess: (updated) => {
      qc.setQueryData(cashClosingKeys.tally(updated.date), updated)
      void qc.invalidateQueries({ queryKey: cashClosingKeys.history })
    },
  })
}
