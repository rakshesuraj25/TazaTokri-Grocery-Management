import { api } from '@/lib/api'
import type {
  Category,
  CreateVegetableRequest,
  PublicVegetable,
  StaffCatalogItem,
  UpdateVegetableRequest,
  VegetableResponse,
} from './types'

export const catalogApi = {
  /** Public catalog (no auth required) */
  listPublicVegetables: () =>
    api.get<PublicVegetable[]>('/api/public/vegetables', { public: true }),

  /** Staff / Owner categories */
  listCategories: () => api.get<Category[]>('/api/categories'),
  createCategory: (body: { name: string }) => api.post<Category>('/api/categories', body),

  /** Staff / Owner vegetables */
  listVegetables: () => api.get<VegetableResponse[]>('/api/vegetables'),
  getVegetable: (id: number | string) => api.get<VegetableResponse>(`/api/vegetables/${id}`),
  createVegetable: (body: CreateVegetableRequest) =>
    api.post<VegetableResponse>('/api/vegetables', body),
  updateVegetable: (id: number | string, body: UpdateVegetableRequest) =>
    api.put<VegetableResponse>(`/api/vegetables/${id}`, body),
  setAvailability: (id: number | string, value: boolean) =>
    api.patch<VegetableResponse>(`/api/vegetables/${id}/availability?value=${value}`),
  setActive: (id: number | string, value: boolean) =>
    api.patch<VegetableResponse>(`/api/vegetables/${id}/active?value=${value}`),

  /**
   * Combined staff catalog (vegetables + current price + stock in one call).
   */
  listStaffCatalog: () => api.get<StaffCatalogItem[]>('/api/staff/catalog'),
}
