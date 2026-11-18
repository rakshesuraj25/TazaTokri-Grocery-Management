import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { combosApi } from './api'
import type { ComboUpsertRequest } from './types'

export const comboKeys = {
  all: ['combos'] as const,
  public: () => [...comboKeys.all, 'public'] as const,
  staff: () => [...comboKeys.all, 'staff'] as const,
}

export function usePublicCombos(enabled = true) {
  return useQuery({
    queryKey: comboKeys.public(),
    queryFn: () => combosApi.listPublic(),
    enabled,
  })
}

export function useStaffCombos(enabled = true) {
  return useQuery({
    queryKey: comboKeys.staff(),
    queryFn: () => combosApi.listStaff(),
    enabled,
  })
}

export function useCreateCombo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ComboUpsertRequest) => combosApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.all })
    },
  })
}

export function useUpdateCombo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | string; body: ComboUpsertRequest }) =>
      combosApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.all })
    },
  })
}

export function useToggleComboAvailable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: number | string; value: boolean }) =>
      combosApi.setAvailable(id, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.all })
    },
  })
}

export function useToggleComboActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: number | string; value: boolean }) =>
      combosApi.setActive(id, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.all })
    },
  })
}

export function useSeedDefaultCombos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => combosApi.seedDefaults(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.all })
    },
  })
}
