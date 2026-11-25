import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Clock, Scale, Sprout, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VegetableImage } from '@/components/VegetableImage'
import { useAuthStore } from '@/features/auth/store'
import { postLoginPath } from '@/features/auth/roles'
import type { PublicVegetable } from '@/features/catalog/types'
import { isSameDayDeliveryIST } from '@/lib/businessRules'
import { usePublicStoreSettings } from '@/features/settings/hooks'
import { fmtDate, todayIST } from '@/lib/dates'
import { formatMoney } from '@/lib/money'

interface ShopHeroProps {
  featuredVegetables?: PublicVegetable[]
}

export function ShopHero({ featuredVegetables = [] }: ShopHeroProps) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { settings } = usePublicStoreSettings()
  const isSameDay = isSameDayDeliveryIST(new Date(), settings.cutoffTime)
  const pickedDate = fmtDate(todayIST())
  const [heroImgFailed, setHeroImgFailed] = useState(false)
  void featuredVegetables

  return (
    <section className="space-y-4">
      <div className="bg-card border-border relative overflow-hidden rounded-[22px] border shadow-[0_3px_12px_rgba(34,44,35,0.04)]">
        {/* Subtle restrained botanical corner accent */}
        <svg
          aria-hidden="true"
          viewBox="0 0 120 120"
          className="text-primary pointer-events-none absolute -bottom-4 -left-4 size-32 opacity-[0.05]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 108C22 72 48 44 92 28C76 62 52 92 12 108Z" />
          <path d="M12 108C40 80 64 56 92 28" />
        </svg>
        <div className="grid items-center gap-5 p-4 min-[390px]:p-5 md:grid-cols-[0.95fr_1.05fr] md:gap-8 md:p-8 lg:min-h-[420px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:p-10">
          <div className="min-w-0 space-y-3.5 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-accent text-accent-foreground inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase">
                <Sprout className="text-primary size-3.5 shrink-0" aria-hidden />
                <span>
                  {t('shop.pickedFresh', {
                    date: pickedDate,
                    defaultValue: `Picked fresh today, ${pickedDate}`,
                  })}
                </span>
              </span>

              <span className="bg-surface-subtle text-muted-foreground inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium">
                <Clock className="text-tomato size-3.5 shrink-0" aria-hidden />
                <span>{isSameDay ? t('shop.cutoffBefore') : t('shop.cutoffAfter')}</span>
              </span>
            </div>

            <div className="space-y-2 sm:space-y-2.5">
              <h1 className="font-organic text-foreground text-[28px] leading-[1.12] font-normal tracking-[-0.015em] min-[390px]:text-[32px] sm:text-[42px] lg:text-[50px]">
                {t('shop.editorialHeroTitle', { defaultValue: 'Freshness for every home.' })}
              </h1>
              <p className="text-muted-foreground max-w-md text-[14px] leading-relaxed sm:text-[16px]">
                {t('shop.hero.subtitle', {
                  defaultValue: 'Good vegetables. Honest prices. Delivered to your home.',
                })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-0.5 sm:gap-4">
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-deep-green h-11 rounded-[10px] px-6 text-[14px] font-semibold shadow-xs transition-colors duration-200 sm:h-12 sm:px-7 sm:text-[15px]"
              >
                <a href="#shop-catalog">
                  {t('shop.shopNowCta', { defaultValue: 'Shop fresh vegetables' })}
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              </Button>

              {user &&
                user.roles.some((r) => r === 'OWNER' || r === 'STAFF' || r === 'DELIVERY') && (
                  <Link
                    to={postLoginPath(user.roles)}
                    className="text-primary inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    {t('landing.continueAs')}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                )}
            </div>
          </div>

          {/* Large unobstructed editorial produce photography */}
          <div className="bg-surface-subtle border-border relative aspect-[16/10] w-full overflow-hidden rounded-[16px] border md:h-[310px] md:aspect-auto lg:h-[360px]">
            {!heroImgFailed ? (
              <img
                src="/hero-produce.jpg"
                alt={t('shop.editorialHeroTitle', { defaultValue: 'Freshness for every home.' })}
                loading="eager"
                decoding="async"
                onError={() => setHeroImgFailed(true)}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="grid h-full w-full grid-cols-2 gap-3 p-3">
                <VegetableImage nameEn="Tomato" size="card" className="rounded-xl" priority />
                <VegetableImage nameEn="Capsicum" size="card" className="rounded-xl" priority />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compact freshness & delivery benefit strip */}
      <div className="bg-card border-border grid gap-3 rounded-[16px] border px-4 py-3.5 shadow-[0_3px_12px_rgba(34,44,35,0.04)] sm:grid-cols-3 sm:gap-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Sprout className="size-4" aria-hidden />
          </div>
          <p className="text-foreground text-[13px] font-medium">
            {t('shop.trustPickedTitle', { defaultValue: 'Picked fresh' })} ·{' '}
            <span className="text-brand-muted font-normal">
              {t('shop.trustPickedBody', {
                defaultValue: 'Hand-sorted every morning for your kitchen.',
              })}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Scale className="size-4" aria-hidden />
          </div>
          <p className="text-foreground text-[13px] font-medium">
            {t('shop.trustWeightTitle', { defaultValue: 'Pay for actual weight' })} ·{' '}
            <span className="text-brand-muted font-normal">
              {t('shop.trustWeightBody', {
                defaultValue: 'Final bill is based on the exact weight packed.',
              })}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Truck className="size-4" aria-hidden />
          </div>
          <p className="text-foreground text-[13px] font-medium">
            {t('shop.minOrderRule', {
              amount: formatMoney(settings.minOrder),
              defaultValue: `Min. order ${formatMoney(settings.minOrder)}`,
            })}{' '}
            ·{' '}
            <span className="text-brand-muted font-normal">
              {t('shop.deliveryRule', {
                fee: formatMoney(settings.deliveryFee),
                threshold: formatMoney(settings.freeDeliveryAbove),
                defaultValue: `Delivery ${formatMoney(settings.deliveryFee)} · Free above ${formatMoney(settings.freeDeliveryAbove)}`,
              })}
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
