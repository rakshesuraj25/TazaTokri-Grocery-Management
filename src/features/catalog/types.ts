export type BaseUnit = 'KG' | 'PIECE' | 'BUNCH'

export interface PublicUnitOption {
  unitId: number
  label: string
  quantityInBaseUnit: string | number
  price: string | number | null
  defaultOption: boolean
}

export interface PublicVegetable {
  id: number
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  imageUrl?: string | null
  category: string
  baseUnit: BaseUnit
  pricePerUnit: string | number | null
  inStock: boolean
  options: PublicUnitOption[]
}

export interface Category {
  id: number
  name: string
  active: boolean
}

export interface VegetableUnit {
  id: number
  label: string
  quantityInBaseUnit: string | number
  defaultOption: boolean
}

export interface VegetableResponse {
  id: number
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  imageUrl?: string | null
  categoryId: number
  categoryName: string
  baseUnit: BaseUnit
  active: boolean
  available: boolean
  units: VegetableUnit[]
}

export interface CreateVegetableUnitInput {
  label: string
  quantityInBaseUnit: string
  defaultOption: boolean
}

export interface CreateVegetableRequest {
  nameEn: string
  nameMr?: string
  nameHi?: string
  imageUrl?: string
  categoryId: number
  baseUnit: BaseUnit
  units: CreateVegetableUnitInput[]
}

export interface UpdateVegetableRequest {
  nameEn: string
  nameMr?: string
  nameHi?: string
  imageUrl?: string
  categoryId: number
}

/**
 * Staff unified catalog item (vegetables + current price + stock in ONE call).
 * Used by quick-sale, stock, and pricing screens via GET /api/staff/catalog.
 */
export interface StaffCatalogOption {
  unitId: string | number
  label: string
  quantityInBaseUnit: string | number
  defaultOption: boolean
}

export interface StaffCatalogItem {
  id: string | number
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  imageUrl?: string | null
  category: string
  baseUnit: BaseUnit
  pricePerUnit: string | number | null
  stock: string | number
  available: boolean
  options: StaffCatalogOption[]
}
