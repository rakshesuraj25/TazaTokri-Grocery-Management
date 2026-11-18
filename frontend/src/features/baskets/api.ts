import { api } from '@/lib/api'
import type {
  BasketUpsertRequest,
  SavedBasketDto,
  ScheduleUpsertRequest,
} from './types'

export const basketsApi = {
  list: () => api.get<SavedBasketDto[]>('/api/my/baskets'),

  reminders: () => api.get<SavedBasketDto[]>('/api/my/baskets/reminders'),

  create: (body: BasketUpsertRequest) =>
    api.post<SavedBasketDto>('/api/my/baskets', body),

  update: (id: number | string, body: BasketUpsertRequest) =>
    api.put<SavedBasketDto>(`/api/my/baskets/${id}`, body),

  delete: (id: number | string) =>
    api.delete<void>(`/api/my/baskets/${id}`),

  upsertSchedule: (id: number | string, body: ScheduleUpsertRequest) =>
    api.put<SavedBasketDto>(`/api/my/baskets/${id}/schedule`, body),

  pauseSchedule: (id: number | string) =>
    api.post<SavedBasketDto>(`/api/my/baskets/${id}/schedule/pause`),

  resumeSchedule: (id: number | string) =>
    api.post<SavedBasketDto>(`/api/my/baskets/${id}/schedule/resume`),

  cancelSchedule: (id: number | string) =>
    api.delete<SavedBasketDto>(`/api/my/baskets/${id}/schedule`),
}
