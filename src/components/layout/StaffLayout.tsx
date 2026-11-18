import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BookOpen,
  Truck,
  Tag,
  Users,
  CreditCard,
  Warehouse,
  ShoppingBag,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  ChevronRight,
  Monitor,
} from 'lucide-react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Logo, LogoMark } from '@/components/Logo'
import { RoleSwitcher } from '@/components/RoleSwitcher'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/features/auth/store'
import { useLogout } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'

interface StaffNavItem {
  to: string
  icon: ReactNode
  label: string
}

interface StaffNavGroup {
  id: string
  heading: string
  items: StaffNavItem[]
}

const SIDEBAR_STORAGE_KEY = 'tazatokri.sidebar.collapsed'

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (saved === 'true') return true
    if (saved === 'false') return false
  } catch {
    // ignore storage restrictions
  }
  return window.innerWidth < 1024
}

export function StaffLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed)

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
    } catch {
      // ignore storage restrictions
    }
  }, [collapsed])

  const isOwner = Boolean(user?.roles.includes('OWNER'))
  const displayIdentity = user?.fullName || user?.phone || t('app.staffArea')
  const primaryRole = user?.roles[0]
  const initials = (displayIdentity || 'TT').trim().slice(0, 2).toUpperCase()

  const navGroups: StaffNavGroup[] = useMemo(
    () => [
      ...(isOwner
        ? [
            {
              id: 'today',
              heading: t('staff.groups.today'),
              items: [
                {
                  to: '/staff/dashboard',
                  icon: <LayoutDashboard className="size-5 shrink-0" aria-hidden />,
                  label: t('nav.dashboard'),
                },
              ],
            },
          ]
        : []),
      {
        id: 'sell',
        heading: t('staff.groups.sell'),
        items: [
          {
            to: '/staff/sale',
            icon: <ShoppingCart className="size-5 shrink-0" aria-hidden />,
            label: t('nav.sale'),
          },
        ],
      },
      {
        id: 'products',
        heading: t('staff.groups.products', { defaultValue: 'Products' }),
        items: [
          {
            to: '/staff/catalog',
            icon: <BookOpen className="size-5 shrink-0" aria-hidden />,
            label: t('nav.catalog'),
          },
          ...(isOwner
            ? [
                {
                  to: '/staff/pricing',
                  icon: <Tag className="size-5 shrink-0" aria-hidden />,
                  label: t('nav.pricing'),
                },
              ]
            : []),
          {
            to: '/staff/stock',
            icon: <Warehouse className="size-5 shrink-0" aria-hidden />,
            label: t('nav.stock'),
          },
        ],
      },
      {
        id: 'buy',
        heading: t('staff.groups.buy', { defaultValue: 'Buy' }),
        items: [
          {
            to: '/staff/purchases',
            icon: <ShoppingBag className="size-5 shrink-0" aria-hidden />,
            label: t('staff.purchase.purchasesTitle'),
          },
          {
            to: '/staff/suppliers',
            icon: <Truck className="size-5 shrink-0" aria-hidden />,
            label: t('nav.suppliers'),
          },
        ],
      },
      {
        id: 'orders',
        heading: t('staff.groups.orders'),
        items: [
          {
            to: '/staff/orders',
            icon: <Package className="size-5 shrink-0" aria-hidden />,
            label: t('nav.ordersStaff'),
          },
        ],
      },
      ...(isOwner
        ? [
            {
              id: 'money',
              heading: t('staff.groups.money'),
              items: [
                {
                  to: '/staff/payments',
                  icon: <CreditCard className="size-5 shrink-0" aria-hidden />,
                  label: t('nav.payments'),
                },
              ],
            },
            {
              id: 'team',
              heading: t('staff.groups.team'),
              items: [
                {
                  to: '/staff/users',
                  icon: <Users className="size-5 shrink-0" aria-hidden />,
                  label: t('nav.users'),
                },
              ],
            },
          ]
        : []),
    ],
    [isOwner, t],
  )

  const currentLocationInfo = useMemo(() => {
    for (const group of navGroups) {
      const match = group.items.find((item) => location.pathname.startsWith(item.to))
      if (match) return { group: group.heading, label: match.label }
    }
    return { group: t('app.staffArea'), label: t('app.name') }
  }, [navGroups, location.pathname, t])

  const renderDesktopLink = (item: StaffNavItem) => {
    const linkNode = (
      <NavLink
        key={item.to}
        to={item.to}
        aria-label={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'touch-target flex items-center rounded-xl text-sm font-medium transition-all duration-150',
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
            isActive
              ? 'bg-turmeric-light text-turmeric-foreground ring-turmeric/40 font-bold ring-1'
              : 'text-muted-foreground hover:bg-secondary/75 hover:text-primary',
          )
        }
      >
        {item.icon}
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    )

    if (!collapsed) return linkNode

    return (
      <Tooltip key={item.to}>
        <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="bg-background flex min-h-screen">
      {/* Desktop collapsible / Tablet compact sidebar */}
      <aside
        data-testid="staff-sidebar"
        data-collapsed={collapsed ? 'true' : 'false'}
        className={cn(
          'bg-card border-border/80 hidden flex-shrink-0 flex-col border-r transition-[width] duration-200 md:flex',
          collapsed ? 'w-[74px]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'border-border/80 flex h-16 items-center border-b px-3',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {collapsed ? (
            <Link to="/staff" aria-label={t('app.name')} className="touch-target flex items-center justify-center">
              <LogoMark size="sm" decorative />
            </Link>
          ) : (
            <Link to="/staff" className="touch-target flex items-center">
              <Logo size="sm" showDevanagari />
            </Link>
          )}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(true)}
                  aria-label={t('staff.sidebar.collapse')}
                  className="text-muted-foreground hover:text-primary size-8 rounded-lg"
                >
                  <PanelLeftClose className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('staff.sidebar.collapse')}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {collapsed && (
          <div className="border-border/60 flex justify-center border-b py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(false)}
                  aria-label={t('staff.sidebar.expand')}
                  className="text-muted-foreground hover:text-primary size-9 rounded-xl"
                >
                  <PanelLeftOpen className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('staff.sidebar.expand')}</TooltipContent>
            </Tooltip>
          </div>
        )}

        <nav aria-label={t('app.staffArea')} className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4">
          {navGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              {!collapsed ? (
                <p className="text-muted-foreground/80 px-3 text-[11px] font-bold tracking-wider uppercase">
                  {group.heading}
                </p>
              ) : (
                <div className="bg-border/60 mx-3 my-1.5 h-px" aria-hidden />
              )}
              <div className="space-y-1">{group.items.map(renderDesktopLink)}</div>
            </div>
          ))}
        </nav>

        <div className="border-border/80 space-y-2 border-t p-3">
          {!collapsed ? (
            <div className="bg-surface-subtle/70 flex items-center gap-2.5 rounded-xl p-2">
              <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-xs font-bold">{displayIdentity}</p>
                {primaryRole && (
                  <p className="text-muted-foreground truncate text-[11px]">{t(`roles.${primaryRole}`)}</p>
                )}
              </div>
            </div>
          ) : null}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  aria-label={t('common.logout')}
                  className="text-muted-foreground hover:text-tomato w-full rounded-xl"
                >
                  <LogOut className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('common.logout')}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-muted-foreground hover:text-tomato w-full justify-start rounded-xl px-2.5"
            >
              <LogOut className="size-4" aria-hidden />
              {t('common.logout')}
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="bg-card/95 border-border/80 sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b px-3 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            {/* Mobile slide-out drawer trigger */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('staff.sidebar.openMenu')}
              className="text-foreground shrink-0 rounded-xl md:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </Button>

            <Link
              to="/staff"
              className="touch-target flex shrink-0 items-center gap-1.5 md:hidden"
              aria-label={t('app.name')}
            >
              <LogoMark size="sm" decorative />
            </Link>

            {/* Breadcrumb / active context pill on >= sm */}
            <div className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
              <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                {currentLocationInfo.group}
              </span>
              <ChevronRight className="text-muted-foreground/60 size-3.5 shrink-0" aria-hidden />
              <span className="text-foreground font-display truncate font-bold">
                {currentLocationInfo.label}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <div className="hidden items-center gap-1.5 xl:flex">
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground rounded-full text-xs">
                <Link to="/shop">
                  <Store className="size-3.5" aria-hidden />
                  <span>{t('staff.sidebar.viewShop')}</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground rounded-full text-xs">
                <Link to="/display/prices">
                  <Monitor className="size-3.5" aria-hidden />
                  <span>{t('staff.sidebar.priceBoard')}</span>
                </Link>
              </Button>
            </div>

            <RoleSwitcher />
            <LanguageSwitcher />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile slide-out navigation drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-[86vw] max-w-xs flex-col p-0">
          <SheetHeader className="border-border border-b px-4 py-4">
            <SheetTitle className="flex items-center justify-between">
              <Logo size="sm" showDevanagari />
              {primaryRole && (
                <Badge variant="secondary" className="text-[11px]">
                  {t(`roles.${primaryRole}`)}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <nav aria-label={t('app.staffArea')} className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
            {navGroups.map((group) => (
              <div key={group.id} className="space-y-1">
                <p className="text-muted-foreground/80 px-3 text-[11px] font-bold tracking-wider uppercase">
                  {group.heading}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(({ to, icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'touch-target flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-turmeric-light text-turmeric-foreground font-bold'
                            : 'text-foreground hover:bg-secondary/60 hover:text-primary',
                        )
                      }
                    >
                      {icon}
                      <span className="truncate">{label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-border/70 space-y-1 border-t pt-3">
              <Link
                to="/shop"
                onClick={() => setDrawerOpen(false)}
                className="touch-target text-muted-foreground hover:bg-secondary/60 hover:text-primary flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium"
              >
                <Store className="size-4" aria-hidden />
                <span>{t('staff.sidebar.viewShop')}</span>
              </Link>
              <Link
                to="/display/prices"
                onClick={() => setDrawerOpen(false)}
                className="touch-target text-muted-foreground hover:bg-secondary/60 hover:text-primary flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium"
              >
                <Monitor className="size-4" aria-hidden />
                <span>{t('staff.sidebar.priceBoard')}</span>
              </Link>
            </div>
          </nav>

          <div className="border-border bg-surface-subtle/60 flex items-center justify-between gap-2 border-t px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {initials}
              </div>
              <span className="text-foreground truncate text-xs font-semibold">{displayIdentity}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDrawerOpen(false)
                logout()
              }}
              className="text-tomato shrink-0 rounded-full"
            >
              <LogOut className="size-4" aria-hidden />
              {t('common.logout')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
