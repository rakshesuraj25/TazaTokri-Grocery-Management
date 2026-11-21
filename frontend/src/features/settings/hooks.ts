import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_STORE_RULES } from '@/lib/businessRules'
import { storeSettingsApi } from './api'
import type { StoreSettings } from './types'

export const storeSettingsKeys = {
  owner: ['owner', 'settings'] as const,
  public: ['public', 'store-settings'] as const,
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  pincodes: DEFAULT_STORE_RULES.pincodes ?? [],
  minOrder: DEFAULT_STORE_RULES.minOrder,
  deliveryFee: DEFAULT_STORE_RULES.deliveryFee,
  freeDeliveryAbove: DEFAULT_STORE_RULES.freeDeliveryAbove,
  cutoffTime: DEFAULT_STORE_RULES.cutoffTime,
  storeOpen: DEFAULT_STORE_RULES.storeOpen,
}

export function useStoreSettings() {
  return useQuery({
    queryKey: storeSettingsKeys.owner,
    queryFn: () => storeSettingsApi.get(),
  })
}

export function usePublicStoreSettings() {
  const query = useQuery({
    queryKey: storeSettingsKeys.public,
    queryFn: () => storeSettingsApi.getPublic(),
    staleTime: 60_000,
    retry: false,
  })
  return {
    ...query,
    settings: query.data ?? DEFAULT_STORE_SETTINGS,
  }
}

export function useUpdateStoreSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: StoreSettings) => storeSettingsApi.update(body),
    onSuccess: (updated) => {
      qc.setQueryData(storeSettingsKeys.owner, updated)
      qc.setQueryData(storeSettingsKeys.public, updated)
    },
  })
}
