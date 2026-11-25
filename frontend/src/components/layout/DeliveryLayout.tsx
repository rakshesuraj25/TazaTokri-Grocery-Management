import { Outlet, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bike, LogOut } from 'lucide-react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { RoleSwitcher } from '@/components/RoleSwitcher'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/store'
import { useLogout } from '@/features/auth/hooks'

export function DeliveryLayout() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const displayIdentity = user?.fullName || user?.phone

  return (
    <div className="delivery-theme bg-background text-foreground min-h-screen">
      <header className="bg-card/90 border-border sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link
            to="/delivery"
            className="touch-target font-display text-primary flex items-center gap-2 text-lg font-extrabold"
          >
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Bike className="size-4" aria-hidden />
            </span>
            <span>{t('delivery.title')}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <RoleSwitcher />
            <LanguageSwitcher />
            {displayIdentity && (
              <span className="text-muted-foreground hidden text-xs font-medium sm:inline">
                {displayIdentity}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={logout}
              className="touch-target text-muted-foreground hover:text-tomato px-2"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">{t('common.logout')}</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-3.5 py-4 pb-10 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
