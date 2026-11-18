/**
 * MSW mock handler for GET /api/staff/catalog (used ONLY when VITE_USE_MOCKS=true or in tests).
 * In normal runtime (VITE_USE_MOCKS=false), GET /api/staff/catalog hits the real backend directly.
 */
import { http, HttpResponse } from 'msw'
import { DEFAULT_CATALOG_VEGETABLES } from '@/features/catalog/defaultCatalog'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export interface StaffCatalogItem {
  id: string | number
  nameEn: string
  nameMr: string
  nameHi: string
  category: string
  baseUnit: 'KG' | 'PIECE' | 'BUNCH'
  pricePerUnit: string | null
  stock: string
  available: boolean
  options: Array<{
    unitId: string | number
    label: string
    quantityInBaseUnit: string
    defaultOption: boolean
  }>
}

const mockData: StaffCatalogItem[] = DEFAULT_CATALOG_VEGETABLES.map((v, idx) => ({
  id: idx + 1,
  nameEn: v.nameEn,
  nameMr: v.nameMr,
  nameHi: v.nameHi,
  category: v.categoryName,
  baseUnit: v.baseUnit,
  pricePerUnit: null,
  stock: '25.000',
  available: true,
  options: v.units.map((u, uIdx) => ({
    unitId: (idx + 1) * 100 + uIdx + 1,
    label: u.label,
    quantityInBaseUnit: u.quantityInBaseUnit,
    defaultOption: u.defaultOption,
  })),
}))

export const staffCatalogHandler = http.get(`${BASE_URL}/api/staff/catalog`, () => {
  return HttpResponse.json(mockData)
})
