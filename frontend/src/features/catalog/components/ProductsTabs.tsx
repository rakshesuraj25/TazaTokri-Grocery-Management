import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, ImageIcon, Package, Tag, Warehouse } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store'

export function ProductsTabs() {
  const { t } = useTranslation()
  const isOwner = Boolean(useAuthStore((s) => s.user?.roles.includes('OWNER')))

  const tabs = [
    {
      to: '/staff/catalog',
      end: true,
      icon: <BookOpen className="size-4" aria-hidden />,
      label: t('staff.products.tabDetails', { defaultValue: 'Catalog' }),
    },
    ...(isOwner
      ? [
          {
            to: '/staff/catalog/images',
            end: false,
            icon: <ImageIcon className="size-4" aria-hidden />,
            label: t('staff.products.tabImages', { defaultValue: 'Images' }),
          },
          {
            to: '/staff/pricing',
            end: false,
            icon: <Tag className="size-4" aria-hidden />,
            label: t('staff.products.tabPricing', { defaultValue: 'Pricing' }),
          },
        ]
      : []),
    {
      to: '/staff/stock',
      end: false,
      icon: <Warehouse className="size-4" aria-hidden />,
      label: t('staff.products.tabStock', { defaultValue: 'Stock' }),
    },
    {
      to: '/staff/combos',
      end: false,
      icon: <Package className="size-4" aria-hidden />,
      label: t('combos.staffTitle', { defaultValue: 'Combo Packs' }),
    },
  ]

  return (
    <nav
      aria-label={t('nav.products', { defaultValue: 'Products' })}
      className="bg-muted border-border inline-flex max-w-full overflow-x-auto rounded-xl border p-1"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-card text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
