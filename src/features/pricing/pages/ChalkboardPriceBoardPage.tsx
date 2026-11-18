import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { VegetableImage } from '@/components/VegetableImage'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { WeaveDivider } from '@/components/WeaveDivider'
import { getCategoryTheme } from '@/lib/categoryTheme'
import { formatMoney } from '@/lib/money'
import { catalogApi } from '@/features/catalog/api'
import { catalogKeys } from '@/features/catalog/hooks'
import { useVegetableName } from '@/hooks/useVegetableName'
import { fmtTime } from '@/lib/dates'

/**
 * Public read-only chalkboard price board (/display/prices) using public catalog.
 * Refreshes automatically every 60 seconds.
 */
export default function ChalkboardPriceBoardPage() {
  const { t } = useTranslation()
  const { name, subtitle } = useVegetableName()

  const catalog = useQuery({
    queryKey: [...catalogKeys.publicList(), 'display-board'],
    queryFn: () => catalogApi.listPublicVegetables(),
    refetchInterval: 60_000,
  })

  const items = catalog.data
  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>()
    for (const v of items ?? []) {
      if (v.pricePerUnit === null || v.pricePerUnit === undefined) continue
      const list = map.get(v.category) ?? []
      list.push(v)
      map.set(v.category, list)
    }
    return Array.from(map.entries())
  }, [items])

  return (
    <div className="min-h-screen bg-[#122017] p-5 text-[#faf9f6] sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Logo size="lg" showDevanagari wordmarkClassName="text-[#faf9f6]" />
            <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-200">
              {t('staff.pricing.todaysRates', { defaultValue: "Today's Fresh Rates" })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            <div className="flex items-center gap-2 text-xs text-white/75">
              <RefreshCw className="size-3.5" aria-hidden />
              <span>
                {catalog.dataUpdatedAt
                  ? fmtTime(new Date(catalog.dataUpdatedAt))
                  : t('common.loading')}
              </span>
            </div>
          </div>
        </header>
        <WeaveDivider variant="chalkboard" />

        {catalog.isError ? (
          <ErrorState onRetry={() => void catalog.refetch()} />
        ) : grouped.length === 0 ? (
          <EmptyState title={t('common.noData')} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {grouped.map(([category, categoryItems]) => {
              const theme = getCategoryTheme(category)
              return (
                <section
                  key={category}
                  className="rounded-2xl border border-white/15 bg-white/5 p-5 shadow-lg"
                >
                  <h2 className="font-display mb-3 flex items-center gap-2 border-b border-dashed border-amber-300/35 pb-2 text-lg font-extrabold tracking-wide text-amber-300 uppercase">
                    <span aria-hidden className={`size-2.5 rounded-full ${theme.barClass}`} />
                    <span>{category}</span>
                  </h2>
                  <ul className="divide-y divide-dashed divide-white/15">
                    {(categoryItems ?? []).map((veg) => (
                      <li
                        key={veg.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <VegetableImage
                            nameEn={veg.nameEn}
                            imageUrl={veg.imageUrl}
                            category={veg.category}
                            alt={name(veg)}
                            size="xs"
                            className="border-white/20"
                          />
                          <div className="min-w-0">
                            <p className="text-base leading-snug font-semibold break-words">
                              {name(veg)}
                              {!veg.inStock && (
                                <span className="ml-2 text-xs font-normal text-red-300">
                                  ({t('common.outOfStock')})
                                </span>
                              )}
                            </p>
                            {subtitle(veg) && (
                              <p className="text-xs text-white/65 break-words">{subtitle(veg)}</p>
                            )}
                          </div>
                        </div>
                        <span className="money-num font-display shrink-0 text-xl font-extrabold text-emerald-300">
                          {formatMoney(veg.pricePerUnit!)}
                          <span className="text-xs font-normal text-white/70">
                            {' '}
                            / {t(`units.${veg.baseUnit}`, { defaultValue: veg.baseUnit })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
