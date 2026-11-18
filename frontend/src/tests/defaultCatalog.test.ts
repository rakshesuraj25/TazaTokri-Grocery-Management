import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import {
  DEFAULT_CATALOG_CATEGORIES,
  DEFAULT_CATALOG_VEGETABLES,
  seedDefaultCatalog,
} from '@/features/catalog/defaultCatalog'
import {
  EXPECTED_VEGETABLE_DISPLAY_NAMES,
  resolveVegetableImage,
  vegetableSlug,
} from '@/features/catalog/vegetableImages'

const EXPECTED_CONVERSIONS: Record<string, string> = {
  '100g': '0.100',
  '250g': '0.250',
  '500g': '0.500',
  '1kg': '1.000',
  '1 bunch': '1.000',
  '1 piece': '1.000',
}

const EXPECTED_SLUGS = [
  'amaranth',
  'beetroot',
  'bitter-gourd',
  'bottle-gourd',
  'brinjal',
  'cabbage',
  'capsicum',
  'carrot',
  'cauliflower',
  'cluster-beans',
  'cucumber',
  'curry-leaves',
  'dill-leaves',
  'drumstick',
  'fenugreek',
  'french-beans',
  'fresh-coriander',
  'garlic',
  'ginger',
  'green-chilli',
  'green-peas',
  'lemon',
  'mint',
  'okra',
  'onion',
  'potato',
  'pumpkin',
  'radish',
  'raw-banana',
  'ridge-gourd',
  'spinach',
  'spring-onion',
  'sweet-corn',
  'sweet-potato',
  'tomato',
  'yam',
]

describe('default 36-vegetable catalog & self-hosted slug image system', () => {
  it('vegetableSlug returns the exact 36 expected slugs for all 36 display names', () => {
    expect(EXPECTED_VEGETABLE_DISPLAY_NAMES).toHaveLength(36)
    const computedSlugs = EXPECTED_VEGETABLE_DISPLAY_NAMES.map((name) => vegetableSlug(name))
    expect(computedSlugs).toEqual(EXPECTED_SLUGS)

    expect(vegetableSlug('Bottle Gourd (Dudhi)')).toBe('bottle-gourd')
    expect(vegetableSlug('Fresh Coriander')).toBe('fresh-coriander')
    expect(vegetableSlug('Green Chilli (Mirchi)')).toBe('green-chilli')
  })

  it('resolveVegetableImage ignores Wikimedia URLs, keeps /vegetables/ and non-Wikimedia https:// URLs, and defaults to /vegetables/<slug>.jpg', () => {
    expect(resolveVegetableImage('Bottle Gourd (Dudhi)')).toBe('/vegetables/bottle-gourd.jpg')
    expect(
      resolveVegetableImage(
        'Bottle Gourd (Dudhi)',
        'https://commons.wikimedia.org/wiki/Special:FilePath/Lagenaria_siceraria.jpg?width=640',
      ),
    ).toBe('/vegetables/bottle-gourd.jpg')
    expect(
      resolveVegetableImage('Tomato', '/vegetables/custom-tomato.jpg'),
    ).toBe('/vegetables/custom-tomato.jpg')
    expect(
      resolveVegetableImage('Tomato', 'https://cdn.tazatokri.in/photos/tomato.jpg'),
    ).toBe('https://cdn.tazatokri.in/photos/tomato.jpg')
  })

  it('defines all 36 vegetables across the 3 categories with trilingual names, valid conversion values, single default unit, and zero bundled prices', () => {
    expect(DEFAULT_CATALOG_CATEGORIES).toEqual([
      'Leafy Greens',
      'Everyday Vegetables',
      'Roots & Tubers',
    ])
    expect(DEFAULT_CATALOG_VEGETABLES).toHaveLength(36)

    const leafy = DEFAULT_CATALOG_VEGETABLES.filter((v) => v.categoryName === 'Leafy Greens')
    const everyday = DEFAULT_CATALOG_VEGETABLES.filter(
      (v) => v.categoryName === 'Everyday Vegetables',
    )
    const roots = DEFAULT_CATALOG_VEGETABLES.filter((v) => v.categoryName === 'Roots & Tubers')

    expect(leafy).toHaveLength(8)
    expect(everyday).toHaveLength(17)
    expect(roots).toHaveLength(11)

    const namesSeen = new Set<string>()
    const slugUrlsSeen = new Set<string>()

    for (const veg of DEFAULT_CATALOG_VEGETABLES) {
      expect(veg.nameEn.trim().length).toBeGreaterThan(0)
      expect(veg.nameMr.trim().length).toBeGreaterThan(0)
      expect(veg.nameHi.trim().length).toBeGreaterThan(0)
      expect('samplePrice' in veg).toBe(false)
      expect('priceNote' in veg).toBe(false)

      const lowerName = veg.nameEn.toLowerCase()
      expect(namesSeen.has(lowerName)).toBe(false)
      namesSeen.add(lowerName)

      expect(veg.units.length).toBeGreaterThan(0)
      const defaults = veg.units.filter((u) => u.defaultOption)
      expect(defaults).toHaveLength(1)

      if (veg.baseUnit === 'BUNCH') {
        expect(defaults[0]?.label).toBe('1 bunch')
      } else if (veg.baseUnit === 'PIECE') {
        expect(defaults[0]?.label).toBe('1 piece')
      } else {
        expect(defaults[0]?.label).toBe('500g')
      }

      const unitLabels = new Set<string>()
      for (const u of veg.units) {
        expect(unitLabels.has(u.label)).toBe(false)
        unitLabels.add(u.label)
        expect(u.quantityInBaseUnit).toBe(EXPECTED_CONVERSIONS[u.label])
      }

      const resolvedUrl = resolveVegetableImage(veg.nameEn)
      expect(resolvedUrl).toBe(`/vegetables/${vegetableSlug(veg.nameEn)}.jpg`)
      expect(slugUrlsSeen.has(resolvedUrl)).toBe(false)
      slugUrlsSeen.add(resolvedUrl)
    }

    expect(slugUrlsSeen.size).toBe(36)

    const byName = new Map(DEFAULT_CATALOG_VEGETABLES.map((v) => [v.nameEn, v]))
    expect(byName.has('Colocasia (Arbi)')).toBe(false)

    const sweetCorn = byName.get('Sweet Corn')
    expect(sweetCorn).toBeDefined()
    expect(sweetCorn?.categoryName).toBe('Roots & Tubers')
    expect(sweetCorn?.nameMr).toBe('स्वीट कॉर्न')
    expect(sweetCorn?.nameHi).toBe('स्वीट कॉर्न')
    expect(sweetCorn?.baseUnit).toBe('PIECE')
    expect(sweetCorn?.units).toEqual([
      { label: '1 piece', quantityInBaseUnit: '1.000', defaultOption: true },
    ])
  })

  it('calls POST /api/vegetables/seed-catalog without client-side sample price seeding', async () => {
    const requestedUrls: string[] = []
    server.use(
      http.post('*/api/vegetables/seed-catalog', ({ request }) => {
        requestedUrls.push(request.url)
        return HttpResponse.json({
          categoriesCreated: 3,
          categoriesReused: 0,
          vegetablesAdded: 30,
          vegetablesReused: 6,
          vegetablesUpdated: 0,
          pricesCreated: 0,
          totalVegetables: 36,
        })
      }),
    )

    const summary = await seedDefaultCatalog()
    expect(summary.totalVegetables).toBe(36)
    expect(summary.vegetablesAdded).toBe(30)
    expect(summary.vegetablesReused).toBe(6)
    expect(summary.pricesCreated).toBe(0)
    expect(requestedUrls[0]).toMatch(/\/api\/vegetables\/seed-catalog$/)
  })
})
