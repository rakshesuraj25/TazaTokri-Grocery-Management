import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { basketsApi } from './api'
import type { BasketUpsertRequest, ScheduleUpsertRequest } from './types'

export const basketKeys = {
  all: ['baskets'] as const,
  list: () => [...basketKeys.all, 'list'] as const,
  reminders: () => [...basketKeys.all, 'reminders'] as const,
}

export function useSavedBaskets(enabled = true) {
  return useQuery({
    queryKey: basketKeys.list(),
    queryFn: () => basketsApi.list(),
    enabled,
  })
}

export function useBasketReminders(enabled = true) {
  return useQuery({
    queryKey: basketKeys.reminders(),
    queryFn: () => basketsApi.reminders(),
    enabled,
  })
}

export function useCreateBasket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BasketUpsertRequest) => basketsApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: basketKeys.all })
    },
  })
}

export function useUpdateBasket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | string; body: BasketUpsertRequest }) =>
      basketsApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: basketKeys.all })
    },
  })
}

export function useDeleteBasket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => basketsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: basketKeys.all })
    },
  })
}

export function useUpsertBasketSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | string; body: ScheduleUpsertRequest }) =>
      basketsApi.upsertSchedule(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: basketKeys.all })
    },
  })
}

export function usePauseBasketSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => basketsApi.pauseSchedule(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: basketKeys.all })
    },
  })
}

export function useResumeBasketSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => basketsApi.resumeSchedule(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: basketKeys.all })
    },
  })
}

export function useCancelBasketSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => basketsApi.cancelSchedule(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: basketKeys.all })
    },
  })
}
