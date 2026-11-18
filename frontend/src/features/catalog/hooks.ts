import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { catalogApi } from './api'
import { seedDefaultCatalog } from './defaultCatalog'
import type {
  CreateVegetableRequest,
  StaffCatalogItem,
  UpdateVegetableRequest,
} from './types'

export const catalogKeys = {
  all: ['catalog'] as const,
  publicList: () => [...catalogKeys.all, 'public'] as const,
  staffCatalog: () => [...catalogKeys.all, 'staff'] as const,
  categories: () => [...catalogKeys.all, 'categories'] as const,
  vegetables: () => [...catalogKeys.all, 'vegetables'] as const,
  vegetable: (id: number | string) => [...catalogKeys.all, 'vegetable', String(id)] as const,
}

export function usePublicVegetables() {
  return useQuery({
    queryKey: catalogKeys.publicList(),
    queryFn: () => catalogApi.listPublicVegetables(),
  })
}

export function useStaffCatalog() {
  return useQuery({
    queryKey: catalogKeys.staffCatalog(),
    queryFn: () => catalogApi.listStaffCatalog(),
    staleTime: 0,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: () => catalogApi.listCategories(),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string }) => catalogApi.createCategory(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: catalogKeys.categories() })
    },
  })
}

export function useVegetables() {
  return useQuery({
    queryKey: catalogKeys.vegetables(),
    queryFn: () => catalogApi.listVegetables(),
  })
}

export function useVegetable(id?: number | string) {
  return useQuery({
    queryKey: catalogKeys.vegetable(id ?? ''),
    queryFn: () => catalogApi.getVegetable(id!),
    enabled: id !== undefined && id !== '',
  })
}

export function useCreateVegetable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateVegetableRequest) => catalogApi.createVegetable(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

export function useUpdateVegetable(id: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateVegetableRequest) => catalogApi.updateVegetable(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

/**
 * Optimistic toggle for today's availability on a vegetable.
 */
export function useToggleAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: number | string; value: boolean }) =>
      catalogApi.setAvailability(id, value),
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: catalogKeys.staffCatalog() })
      const prev = qc.getQueryData<StaffCatalogItem[]>(catalogKeys.staffCatalog())
      if (prev) {
        qc.setQueryData<StaffCatalogItem[]>(
          catalogKeys.staffCatalog(),
          prev.map((item) => (String(item.id) === String(id) ? { ...item, available: value } : item)),
        )
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(catalogKeys.staffCatalog(), ctx.prev)
      toast.error('Could not update availability')
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

export function useToggleActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: number | string; value: boolean }) =>
      catalogApi.setActive(id, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

export function useSeedCatalog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => seedDefaultCatalog(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: catalogKeys.all })
      void qc.invalidateQueries({ queryKey: ['pricing'] })
    },
  })
}
