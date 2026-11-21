import { api } from '@/lib/api'
import type { StoreSettings } from './types'

export const storeSettingsApi = {
  get: () => api.get<StoreSettings>('/api/owner/settings'),
  getPublic: () => api.get<StoreSettings>('/api/public/store-settings'),
  update: (body: StoreSettings) => api.put<StoreSettings>('/api/owner/settings', body),
}
