import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Banknote, Clock, Scale, Sprout, Truck } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { WeaveDivider } from '@/components/WeaveDivider'
import { usePublicStoreSettings } from '@/features/settings/hooks'
import { formatMoney } from '@/lib/money'

export function ShopTrustFooter() {
  const { t } = useTranslation()
  const { settings } = usePublicStoreSettings()

  const pillars = [
    {
      icon: <Sprout className="text-primary size-5" aria-hidden />,
      title: t('shop.trustPickedTitle', { defaultValue: 'Picked fresh' }),
      body: t('shop.trustPickedBody', {
        defaultValue: 'Hand-sorted every morning for your kitchen.',
      }),
    },
    {
      icon: <Scale className="text-primary size-5" aria-hidden />,
      title: t('shop.trustWeightTitle', { defaultValue: 'Pay for actual weight' }),
      body: t('shop.trustWeightBody', {
        defaultValue: 'Final bill is based on the exact weight packed.',
      }),
    },
    {
      icon: <Banknote className="text-primary size-5" aria-hidden />,
      title: t('shop.trustPaymentTitle', { defaultValue: 'Cash or UPI on delivery' }),
      body: t('shop.trustPaymentBody', {
        defaultValue: 'Pay conveniently at your doorstep via Cash or UPI.',
      }),
    },
  ]

  return (
    <footer className="mt-10 space-y-6 pt-4 pb-6">
      <WeaveDivider />

      <div className="bg-surface-subtle/90 border-border/80 grid gap-5 rounded-2xl border px-5 py-6 sm:grid-cols-3 sm:px-7">
        {pillars.map((p) => (
          <div key={p.title} className="flex items-start gap-3">
            <div className="bg-card border-border/80 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs">
              {p.icon}
            </div>
            <div className="space-y-0.5">
              <h2 className="font-display text-foreground text-sm font-bold">{p.title}</h2>
              <p className="text-muted-foreground text-xs leading-relaxed">{p.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border-border/90 grid gap-6 rounded-2xl border px-5 py-6 shadow-2xs sm:grid-cols-[1.4fr_1fr_1fr] sm:px-7">
        <div className="space-y-2.5">
          <Logo size="sm" showDevanagari />
          <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
            {t('shop.footerTagline', {
              defaultValue: 'Fresh everyday vegetables from our neighbourhood shop.',
            })}
          </p>
        </div>

        <div className="space-y-1.5 text-xs">
          <h3 className="font-display text-foreground text-xs font-bold tracking-wider uppercase">
            {t('shop.footerDeliveryTitle', { defaultValue: 'Delivery Info' })}
          </h3>
          <p className="text-muted-foreground flex items-center gap-1.5">
            <Clock className="text-primary size-3.5 shrink-0" aria-hidden />
            <span>{t('shop.cutoffBefore')}</span>
          </p>
          <p className="text-muted-foreground flex items-center gap-1.5">
            <Truck className="text-primary size-3.5 shrink-0" aria-hidden />
            <span>
              {t('shop.minOrderRule', { amount: formatMoney(settings.minOrder) })} ·{' '}
              {t('shop.deliveryRule', {
                fee: formatMoney(settings.deliveryFee),
                threshold: formatMoney(settings.freeDeliveryAbove),
              })}
            </span>
          </p>
        </div>

        <div className="space-y-1.5 text-xs">
          <h3 className="font-display text-foreground text-xs font-bold tracking-wider uppercase">
            {t('shop.footerLinksTitle', { defaultValue: 'Quick Links' })}
          </h3>
          <ul className="space-y-1">
            <li>
              <Link to="/shop" className="text-primary font-semibold hover:underline">
                {t('nav.shop')}
              </Link>
            </li>
            <li>
              <Link to="/shop/orders" className="text-muted-foreground hover:text-primary font-medium hover:underline">
                {t('nav.orders')}
              </Link>
            </li>
            <li>
              <Link to="/display/prices" className="text-muted-foreground hover:text-primary font-medium hover:underline">
                {t('shop.viewTodaysRates', { defaultValue: "Today's rate board" })}
              </Link>
            </li>
            <li>
              <Link to="/login" className="text-muted-foreground hover:text-primary font-medium hover:underline">
                {t('auth.login')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
