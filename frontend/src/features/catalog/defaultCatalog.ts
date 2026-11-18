import { api } from '@/lib/api'
import type { BaseUnit, CreateVegetableUnitInput } from './types'

export interface SeedVegetableDefinition {
  nameEn: string
  nameMr: string
  nameHi: string
  categoryName: 'Leafy Greens' | 'Everyday Vegetables' | 'Roots & Tubers'
  baseUnit: BaseUnit
  units: CreateVegetableUnitInput[]
  imageUrl?: string
}

export interface SeedCatalogSummary {
  categoriesCreated: number
  categoriesReused: number
  vegetablesAdded: number
  vegetablesReused: number
  vegetablesUpdated: number
  pricesCreated: number
  totalVegetables: number
  addedVegetables?: string[]
  reusedVegetables?: string[]
  updatedVegetables?: string[]
  pricedVegetables?: string[]
}

const UNITS_BUNCH_1: CreateVegetableUnitInput[] = [
  { label: '1 bunch', quantityInBaseUnit: '1.000', defaultOption: true },
]

const UNITS_PIECE_1: CreateVegetableUnitInput[] = [
  { label: '1 piece', quantityInBaseUnit: '1.000', defaultOption: true },
]

const UNITS_KG_250_500_1KG: CreateVegetableUnitInput[] = [
  { label: '250g', quantityInBaseUnit: '0.250', defaultOption: false },
  { label: '500g', quantityInBaseUnit: '0.500', defaultOption: true },
  { label: '1kg', quantityInBaseUnit: '1.000', defaultOption: false },
]

const UNITS_KG_500_1KG: CreateVegetableUnitInput[] = [
  { label: '500g', quantityInBaseUnit: '0.500', defaultOption: true },
  { label: '1kg', quantityInBaseUnit: '1.000', defaultOption: false },
]

const UNITS_KG_100_250_500: CreateVegetableUnitInput[] = [
  { label: '100g', quantityInBaseUnit: '0.100', defaultOption: false },
  { label: '250g', quantityInBaseUnit: '0.250', defaultOption: false },
  { label: '500g', quantityInBaseUnit: '0.500', defaultOption: true },
]

export const DEFAULT_CATALOG_CATEGORIES = [
  'Leafy Greens',
  'Everyday Vegetables',
  'Roots & Tubers',
] as const

export const DEFAULT_CATALOG_VEGETABLES: SeedVegetableDefinition[] = [
  // A. Leafy Greens (8)
  {
    nameEn: 'Fresh Coriander',
    nameMr: 'कोथिंबीर',
    nameHi: 'धनिया',
    categoryName: 'Leafy Greens',
    baseUnit: 'BUNCH',
    units: UNITS_BUNCH_1,
  },
  {
    nameEn: 'Spinach (Palak)',
    nameMr: 'पालक',
    nameHi: 'पालक',
    categoryName: 'Leafy Greens',
    baseUnit: 'BUNCH',
    units: UNITS_BUNCH_1,
  },
  {
    nameEn: 'Fenugreek (Methi)',
    nameMr: 'मेथी',
    nameHi: 'मेथी',
    categoryName: 'Leafy Greens',
    baseUnit: 'BUNCH',
    units: UNITS_BUNCH_1,
  },
  {
    nameEn: 'Mint (Pudina)',
    nameMr: 'पुदिना',
    nameHi: 'पुदीना',
    categoryName: 'Leafy Greens',
    baseUnit: 'BUNCH',
    units: UNITS_BUNCH_1,
  },
  {
    nameEn: 'Amaranth (Math)',
    nameMr: 'माठ',
    nameHi: 'चौलाई',
    categoryName: 'Leafy Greens',
    baseUnit: 'BUNCH',
    units: UNITS_BUNCH_1,
  },
  {
    nameEn: 'Dill Leaves (Shepu)',
    nameMr: 'शेपू',
    nameHi: 'सोया साग',
    categoryName: 'Leafy Greens',
    baseUnit: 'BUNCH',
    units: UNITS_BUNCH_1,
  },
  {
    nameEn: 'Spring Onion',
    nameMr: 'पातीचा कांदा',
    nameHi: 'हरा प्याज',
    categoryName: 'Leafy Greens',
    baseUnit: 'BUNCH',
    units: UNITS_BUNCH_1,
  },
  {
    nameEn: 'Curry Leaves',
    nameMr: 'कढीपत्ता',
    nameHi: 'करी पत्ता',
    categoryName: 'Leafy Greens',
    baseUnit: 'BUNCH',
    units: UNITS_BUNCH_1,
  },

  // B. Everyday Vegetables (17)
  {
    nameEn: 'Tomato',
    nameMr: 'टोमॅटो',
    nameHi: 'टमाटर',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Okra (Bhendi)',
    nameMr: 'भेंडी',
    nameHi: 'भिंडी',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Brinjal (Vangi)',
    nameMr: 'वांगी',
    nameHi: 'बैंगन',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Cabbage',
    nameMr: 'कोबी',
    nameHi: 'पत्ता गोभी',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_500_1KG,
  },
  {
    nameEn: 'Cauliflower',
    nameMr: 'फुलकोबी',
    nameHi: 'फूलगोभी',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_500_1KG,
  },
  {
    nameEn: 'Capsicum',
    nameMr: 'ढोबळी मिरची',
    nameHi: 'शिमला मिर्च',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Cucumber',
    nameMr: 'काकडी',
    nameHi: 'खीरा',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Bottle Gourd (Dudhi)',
    nameMr: 'दुधी भोपळा',
    nameHi: 'लौकी',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_500_1KG,
  },
  {
    nameEn: 'Bitter Gourd (Karela)',
    nameMr: 'कारले',
    nameHi: 'करेला',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Ridge Gourd (Dodka)',
    nameMr: 'दोडका',
    nameHi: 'तुरई',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Cluster Beans (Gawar)',
    nameMr: 'गवार',
    nameHi: 'ग्वार फली',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'French Beans',
    nameMr: 'फरसबी',
    nameHi: 'फ्रेंच बीन्स',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Green Peas (Matar)',
    nameMr: 'हिरवे मटार',
    nameHi: 'हरी मटर',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Drumstick (Shevga)',
    nameMr: 'शेवगा',
    nameHi: 'सहजन',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'PIECE',
    units: UNITS_PIECE_1,
  },
  {
    nameEn: 'Raw Banana (Kaccha Kela)',
    nameMr: 'कच्ची केळी',
    nameHi: 'कच्चा केला',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'PIECE',
    units: UNITS_PIECE_1,
  },
  {
    nameEn: 'Lemon (Limbu)',
    nameMr: 'लिंबू',
    nameHi: 'नींबू',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'PIECE',
    units: UNITS_PIECE_1,
  },
  {
    nameEn: 'Green Chilli (Mirchi)',
    nameMr: 'हिरवी मिरची',
    nameHi: 'हरी मिर्च',
    categoryName: 'Everyday Vegetables',
    baseUnit: 'KG',
    units: UNITS_KG_100_250_500,
  },

  // C. Roots & Tubers (11)
  {
    nameEn: 'Onion (Kanda)',
    nameMr: 'कांदा',
    nameHi: 'प्याज',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_500_1KG,
  },
  {
    nameEn: 'Potato (Batata)',
    nameMr: 'बटाटा',
    nameHi: 'आलू',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_500_1KG,
  },
  {
    nameEn: 'Sweet Potato (Ratale)',
    nameMr: 'रताळे',
    nameHi: 'शकरकंद',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_500_1KG,
  },
  {
    nameEn: 'Carrot (Gajar)',
    nameMr: 'गाजर',
    nameHi: 'गाजर',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Beetroot',
    nameMr: 'बीट',
    nameHi: 'चुकंदर',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Radish (Mula)',
    nameMr: 'मुळा',
    nameHi: 'मूली',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_250_500_1KG,
  },
  {
    nameEn: 'Ginger (Ale)',
    nameMr: 'आले',
    nameHi: 'अदरक',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_100_250_500,
  },
  {
    nameEn: 'Garlic (Lasun)',
    nameMr: 'लसूण',
    nameHi: 'लहसुन',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_100_250_500,
  },
  {
    nameEn: 'Sweet Corn',
    nameMr: 'स्वीट कॉर्न',
    nameHi: 'स्वीट कॉर्न',
    categoryName: 'Roots & Tubers',
    baseUnit: 'PIECE',
    units: UNITS_PIECE_1,
  },
  {
    nameEn: 'Yam (Suran)',
    nameMr: 'सुरण',
    nameHi: 'जिमीकंद',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_500_1KG,
  },
  {
    nameEn: 'Pumpkin (Bhopla)',
    nameMr: 'भोपळा',
    nameHi: 'कद्दू',
    categoryName: 'Roots & Tubers',
    baseUnit: 'KG',
    units: UNITS_KG_500_1KG,
  },
]

/**
 * Seeds all 36 vegetables and 3 categories idempotently via the backend endpoint.
 * Never creates stock movements or client-side prices; prices come only from the server.
 */
export async function seedDefaultCatalog(): Promise<SeedCatalogSummary> {
  return api.post<SeedCatalogSummary>('/api/vegetables/seed-catalog')
}
