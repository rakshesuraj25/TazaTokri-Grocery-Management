import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { VegetableImage } from '@/components/VegetableImage'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { cn } from '@/lib/utils'
import type { PublicVegetable } from '../types'

interface ShopFeaturedCategoriesProps {
  categories: string[]
  vegetables: PublicVegetable[]
  selectedCategory: string
  onSelectCategory: (cat: string) => void
}

export function ShopFeaturedCategories({
  categories,
  vegetables,
  selectedCategory,
  onSelectCategory,
}: ShopFeaturedCategoriesProps) {
  const { t } = useTranslation()
  const concreteCategories = categories.filter((c) => c !== 'ALL')

  if (concreteCategories.length < 2) return null

  return (
    <section aria-label={t('shop.featuredCategories', { defaultValue: 'Shop by category' })} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-organic text-foreground text-[26px] font-normal sm:text-[32px]">
          {t('shop.featuredCategories', { defaultValue: 'Shop by category' })}
        </h2>
        {selectedCategory !== 'ALL' && (
          <button
            type="button"
            onClick={() => onSelectCategory('ALL')}
            className="text-primary text-xs font-semibold hover:underline"
          >
            {t('common.all')} ({vegetables.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {concreteCategories.map((cat) => {
          const items = vegetables.filter((v) => v.category === cat)
          const lead = items.find((v) => v.inStock) ?? items[0]
          const theme = getCategoryTheme(cat)
          const active = selectedCategory === cat

          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                onSelectCategory(active ? 'ALL' : cat)
                document.getElementById('shop-catalog')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
              }}
              aria-pressed={active}
              className={cn(
                'bg-card hover:border-primary/40 group flex items-center gap-2.5 rounded-[15px] border p-2.5 text-left shadow-[0_3px_12px_rgba(34,44,35,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(34,44,35,0.08)] sm:gap-3 sm:p-3',
                active
                  ? 'border-primary bg-secondary/75 ring-1 ring-primary/25'
                  : 'border-border',
              )}
            >
              {lead ? (
                <VegetableImage
                  nameEn={lead.nameEn}
                  nameMr={lead.nameMr}
                  nameHi={lead.nameHi}
                  imageUrl={lead.imageUrl}
                  category={lead.category}
                  size="sm"
                />
              ) : (
                <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', theme.washClass)}>
                  <Sparkles className="text-primary size-5" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-[15px] font-semibold">{cat}</p>
                <p className="text-brand-muted money-num text-xs">
                  {t('shop.categoryCount', {
                    count: items.length,
                    defaultValue: `${items.length} items`,
                  })}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
