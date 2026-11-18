import { api } from '@/lib/api'
import type { ComboDto, ComboUpsertRequest } from './types'

export const combosApi = {
  listPublic: () => api.get<ComboDto[]>('/api/public/combos'),

  listStaff: () => api.get<ComboDto[]>('/api/staff/combos'),

  create: (body: ComboUpsertRequest) =>
    api.post<ComboDto>('/api/staff/combos', body),

  update: (id: number | string, body: ComboUpsertRequest) =>
    api.put<ComboDto>(`/api/staff/combos/${id}`, body),

  setAvailable: (id: number | string, value: boolean) =>
    api.patch<ComboDto>(`/api/staff/combos/${id}/available?value=${value}`),

  setActive: (id: number | string, value: boolean) =>
    api.patch<ComboDto>(`/api/staff/combos/${id}/active?value=${value}`),

  seedDefaults: () =>
    api.post<ComboDto[]>('/api/staff/combos/seed-defaults'),
}
