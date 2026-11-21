import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Clock, ShieldCheck, Sprout, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VegetableImage } from '@/components/VegetableImage'
import { WeaveDivider } from '@/components/WeaveDivider'
import { useVegetableName } from '@/hooks/useVegetableName'
import { useAuthStore } from '@/features/auth/store'
import { postLoginPath } from '@/features/auth/roles'
import type { PublicVegetable } from '@/features/catalog/types'
import {
  isSameDayDeliveryIST,
} from '@/lib/businessRules'
import { usePublicStoreSettings } from '@/features/settings/hooks'
import { fmtDate, todayIST } from '@/lib/dates'
import { formatMoney } from '@/lib/money'

const FALLBACK_SHOWCASE = [
  { nameEn: 'Tomato', category: 'Everyday Vegetables' },
  { nameEn: 'Spinach (Palak)', category: 'Leafy Greens' },
  { nameEn: 'Onion (Kanda)', category: 'Roots & Tubers' },
  { nameEn: 'Okra (Bhendi)', category: 'Everyday Vegetables' },
]

interface ShopHeroProps {
  featuredVegetables?: PublicVegetable[]
}

export function ShopHero({ featuredVegetables = [] }: ShopHeroProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const user = useAuthStore((s) => s.user)
  const { settings } = usePublicStoreSettings()
  const isSameDay = isSameDayDeliveryIST(new Date(), settings.cutoffTime)
  const pickedDate = fmtDate(todayIST())

  const liveHighlights = featuredVegetables.filter((v) => v.inStock).slice(0, 4)

  return (
    <section className="space-y-4 py-1 sm:py-2">
      <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-5 py-6 shadow-md sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 size-72 rounded-full bg-white/5"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-black/10"
        />

        <div className="relative grid items-center gap-6 lg:grid-cols-[1.2fr_0.95fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide text-white uppercase backdrop-blur-xs">
                <Sprout className="text-turmeric size-3.5 shrink-0" aria-hidden />
                <span>
                  {t('shop.pickedFresh', {
                    date: pickedDate,
                    defaultValue: `Picked fresh today, ${pickedDate}`,
                  })}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-xs font-medium text-white/95">
                <Clock className="text-turmeric size-3.5 shrink-0" aria-hidden />
                <span>{isSameDay ? t('shop.cutoffBefore') : t('shop.cutoffAfter')}</span>
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="font-organic text-3xl leading-[1.12] font-bold tracking-tight text-white sm:text-4xl lg:text-[2.65rem]">
                {t('shop.editorialHeroTitle', { defaultValue: 'Freshness for every home' })}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
                {t('shop.hero.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                asChild
                size="lg"
                className="bg-turmeric text-turmeric-foreground hover:bg-turmeric/90 rounded-full font-extrabold shadow-sm"
              >
                <a href="#shop-catalog">
                  {t('shop.shopNowCta', { defaultValue: 'Shop fresh vegetables' })}
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              </Button>

              {!user ? (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <Link to="/login">{t('auth.login')}</Link>
                </Button>
              ) : (
                user.roles.some((r) => r === 'OWNER' || r === 'STAFF' || r === 'DELIVERY') && (
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  >
                    <Link to={postLoginPath(user.roles)}>
                      {t('landing.continueAs')}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                )
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/15 pt-3 text-xs font-medium text-white/90 sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="text-turmeric size-4 shrink-0" aria-hidden />
                {t('shop.minOrderRule', {
                  amount: formatMoney(settings.minOrder),
                  defaultValue: `Min. order ${formatMoney(settings.minOrder)}`,
                })}
              </span>
              <span aria-hidden className="text-white/40">
                •
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="text-turmeric size-4 shrink-0" aria-hidden />
                {t('shop.deliveryRule', {
                  fee: formatMoney(settings.deliveryFee),
                  threshold: formatMoney(settings.freeDeliveryAbove),
                  defaultValue: `Delivery ${formatMoney(settings.deliveryFee)} · Free above ${formatMoney(settings.freeDeliveryAbove)}`,
                })}
              </span>
            </div>
          </div>

          {/* Right visual showcase grid from live catalog */}
          <div className="rounded-2xl bg-black/15 p-3.5 backdrop-blur-xs">
            <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-white/90">
              <span>{t('shop.freshArrivals', { defaultValue: "Today's fresh arrivals" })}</span>
              <Link to="/display/prices" className="text-turmeric hover:underline">
                {t('shop.viewTodaysRates', { defaultValue: "Today's rate board" })}
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {liveHighlights.length > 0
                ? liveHighlights.map((veg) => (
                    <a
                      key={String(veg.id)}
                      href="#shop-catalog"
                      className="bg-card/95 text-foreground group flex items-center gap-2.5 rounded-xl p-2 shadow-xs transition-transform duration-150 hover:-translate-y-0.5"
                    >
                      <VegetableImage
                        nameEn={veg.nameEn}
                        nameMr={veg.nameMr}
                        nameHi={veg.nameHi}
                        imageUrl={veg.imageUrl}
                        category={veg.category}
                        alt={name(veg)}
                        size="xs"
                        priority
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{name(veg)}</p>
                        {veg.pricePerUnit && (
                          <p className="text-primary money-num truncate text-[11px] font-extrabold">
                            {formatMoney(veg.pricePerUnit)}/{t(`units.${veg.baseUnit}`, { defaultValue: veg.baseUnit })}
                          </p>
                        )}
                      </div>
                    </a>
                  ))
                : FALLBACK_SHOWCASE.map((item) => (
                    <div
                      key={item.nameEn}
                      className="bg-card/95 text-foreground flex items-center gap-2.5 rounded-xl p-2 shadow-xs"
                    >
                      <VegetableImage
                        nameEn={item.nameEn}
                        category={item.category}
                        size="sm"
                        priority
                      />
                      <span className="truncate text-xs font-bold">{item.nameEn}</span>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>

      <WeaveDivider />
    </section>
  )
}
