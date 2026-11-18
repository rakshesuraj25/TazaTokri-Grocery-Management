import { Outlet, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'

export function PublicLayout() {
  const { t } = useTranslation()
  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card/90 border-border sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/" className="touch-target flex items-center">
            <Logo size="md" showDevanagari />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <Button asChild size="sm" className="touch-target px-4">
              <Link to="/login">{t('auth.login')}</Link>
            </Button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
