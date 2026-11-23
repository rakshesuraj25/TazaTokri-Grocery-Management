import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { ShoppingBag, Package, User, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Logo } from '@/components/Logo'
import { RoleSwitcher } from '@/components/RoleSwitcher'
import { useAuthStore } from '@/features/auth/store'
import { useCartStore } from '@/features/cart/store'

export function CustomerLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const cartCount = useCartStore((s) => s.items.reduce((acc, i) => acc + i.count, 0))

  const accountTarget = user ? '/shop/account' : '/login?next=%2Fshop%2Faccount'
  const ordersTarget = user ? '/shop/orders' : '/login?next=%2Fshop%2Forders'
  const cartTarget = user ? '/shop/checkout' : '/login?next=%2Fshop%2Fcheckout'

  const desktopLinks = [
    { to: '/shop', label: t('nav.shop') },
    { to: ordersTarget, label: t('nav.orders') },
    { to: accountTarget, label: user ? t('nav.account') : t('auth.login') },
  ]

  const isShopRoute = location.pathname === '/' || location.pathname === '/shop'

  return (
    <div className="storefront-theme bg-background text-foreground flex min-h-screen flex-col">
      {/* Editorial customer header */}
      <header className="bg-card/95 sticky top-0 z-40 border-b border-[#E8E2D6] backdrop-blur-md">
        <div className="mx-auto flex h-[64px] max-w-[1240px] items-center justify-between gap-1.5 px-3 min-[390px]:gap-2 min-[390px]:px-4 sm:h-[70px] sm:px-8">
          <Link to="/shop" className="touch-target flex shrink-0 items-center">
            <Logo size="sm" className="min-[400px]:hidden" wordmarkClassName="text-base" />
            <Logo size="md" className="hidden min-[400px]:inline-flex" />
          </Link>

          <nav className="hidden items-center gap-2 lg:flex" aria-label={t('nav.shop')}>
            {desktopLinks.map(({ to, label }) => {
              const active = to === '/shop' ? isShopRoute : location.pathname.startsWith(to.split('?')[0]!)
              return (
                <Link
                  key={to}
                  to={to}
                  className={`touch-target inline-flex items-center whitespace-nowrap rounded-[10px] px-4 text-[15px] font-medium transition-colors duration-200 ${
                    active
                      ? 'bg-secondary text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-primary'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-1.5 min-[390px]:gap-2 sm:gap-3">
            <div className="hidden lg:inline-flex">
              <RoleSwitcher />
            </div>
            <LanguageSwitcher />

            {isShopRoute ? (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('tazatokri:open-cart'))}
                className="touch-target bg-card border-border text-primary hover:border-primary/40 hover:bg-secondary relative flex shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 py-2 text-sm font-semibold shadow-[0_3px_12px_rgba(34,44,35,0.04)] transition-all duration-200 min-[390px]:px-3.5"
                aria-label={`${t('nav.cart')} (${cartCount})`}
              >
                <ShoppingBag className="h-4.5 w-4.5" aria-hidden />
                <span className="hidden sm:inline">{t('nav.cart')}</span>
                {cartCount > 0 && (
                  <span className="bg-primary money-num flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </button>
            ) : (
              <Link
                to={cartTarget}
                className="touch-target bg-card border-border text-primary hover:border-primary/40 hover:bg-secondary relative flex shrink-0 items-center gap-2 rounded-[10px] border px-3.5 py-2 text-sm font-semibold shadow-[0_3px_12px_rgba(34,44,35,0.04)] transition-all duration-200"
                aria-label={`${t('nav.cart')} (${cartCount})`}
              >
                <ShoppingBag className="h-4.5 w-4.5" aria-hidden />
                <span className="hidden sm:inline">{t('nav.cart')}</span>
                {cartCount > 0 && (
                  <span className="bg-primary money-num flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
        {user && user.roles.length > 1 && (
          <div className="border-border/60 bg-surface-subtle/60 flex justify-center border-t px-3 py-1.5 lg:hidden">
            <RoleSwitcher />
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 pb-20 lg:pb-12">
        <Outlet />
      </main>

      {/* Mobile & Tablet bottom bar: Shop, Orders, Cart, Account */}
      <nav
        data-testid="customer-mobile-nav"
        aria-label={t('nav.shop')}
        className="bg-card/95 border-border/80 fixed right-0 bottom-0 left-0 z-40 border-t backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-4">
          <NavLink
            to="/shop"
            className={() =>
              [
                'flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors duration-150',
                isShopRoute ? 'text-primary font-bold' : 'text-muted-foreground hover:text-primary',
              ].join(' ')
            }
          >
            <Store className="size-5" aria-hidden />
            <span className="truncate">{t('nav.shop')}</span>
          </NavLink>

          <NavLink
            to={ordersTarget}
            className={({ isActive }) =>
              [
                'flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors duration-150',
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-primary',
              ].join(' ')
            }
          >
            <Package className="size-5" aria-hidden />
            <span className="truncate">{t('nav.orders')}</span>
          </NavLink>

          <NavLink
            to={cartTarget}
            className={({ isActive }) =>
              [
                'relative flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors duration-150',
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-primary',
              ].join(' ')
            }
          >
            <span className="relative">
              <ShoppingBag className="size-5" aria-hidden />
              {cartCount > 0 && (
                <span className="bg-tomato money-num absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </span>
            <span className="truncate">{t('nav.cart')}</span>
          </NavLink>

          <NavLink
            to={accountTarget}
            className={({ isActive }) =>
              [
                'flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors duration-150',
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-primary',
              ].join(' ')
            }
          >
            <User className="size-5" aria-hidden />
            <span className="truncate">{user ? t('nav.account') : t('auth.login')}</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
