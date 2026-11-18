import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Banknote, Scale, Sprout } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { VegetableImage } from '@/components/VegetableImage'

const SHOWCASE_PRODUCE = [
  { nameEn: 'Tomato', category: 'Everyday Vegetables' },
  { nameEn: 'Spinach (Palak)', category: 'Leafy Greens' },
  { nameEn: 'Carrot (Gajar)', category: 'Roots & Tubers' },
  { nameEn: 'Okra (Bhendi)', category: 'Everyday Vegetables' },
]

export function AuthBrandPanel() {
  const { t } = useTranslation()

  const benefits = [
    {
      icon: <Sprout className="size-4 text-turmeric" aria-hidden />,
      title: t('landing.features.freshTitle'),
      body: t('landing.features.freshBody'),
    },
    {
      icon: <Scale className="size-4 text-turmeric" aria-hidden />,
      title: t('landing.features.honestTitle'),
      body: t('landing.features.honestBody'),
    },
    {
      icon: <Banknote className="size-4 text-turmeric" aria-hidden />,
      title: t('landing.features.fastTitle'),
      body: t('landing.features.fastBody'),
    },
  ]

  return (
    <aside className="bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden rounded-3xl p-8 shadow-md lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -bottom-16 size-64 rounded-full bg-white/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-12 size-48 rounded-full bg-white/5"
      />

      <div className="relative space-y-6">
        <div className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-xs">
          <Sprout className="text-turmeric mr-1.5 size-3.5" aria-hidden />
          {t('landing.badge')}
        </div>

        <Logo size="md" showDevanagari className="[&_span]:text-white [&_.text-muted-foreground]:text-white/75" />

        <div className="space-y-2">
          <h2 className="font-organic text-3xl leading-snug font-bold text-white">
            {t('landing.title')}
          </h2>
          <p className="text-sm leading-relaxed text-white/80">
            {t('landing.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2.5 pt-1">
          {SHOWCASE_PRODUCE.map((item) => (
            <div
              key={item.nameEn}
              className="rounded-2xl bg-white/10 p-1.5 backdrop-blur-xs"
            >
              <VegetableImage
                nameEn={item.nameEn}
                category={item.category}
                size="card"
                className="rounded-xl border-0"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-6 space-y-4">
        <div className="space-y-3 rounded-2xl bg-black/15 p-4 backdrop-blur-xs">
          {benefits.map((b) => (
            <div key={b.title} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0">{b.icon}</span>
              <div>
                <p className="text-xs font-bold text-white">{b.title}</p>
                <p className="text-[11px] leading-relaxed text-white/75">{b.body}</p>
              </div>
            </div>
          ))}
        </div>

        <Button asChild variant="secondary" className="w-full rounded-full font-bold">
          <Link to="/shop">
            {t('landing.browseCta')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </aside>
  )
}
