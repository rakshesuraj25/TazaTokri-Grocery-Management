import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sprout } from 'lucide-react'

interface StatusPageProps {
  icon?: ReactNode
  title: string
  body: string
  action?: ReactNode
}

/** Shared full-page message used by 403 / 404 / coming-soon screens. */
export function StatusPage({ icon, title, body, action }: StatusPageProps) {
  const { t } = useTranslation()
  return (
    <main className="bg-background flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div
        aria-hidden
        className="bg-secondary text-primary flex h-24 w-24 items-center justify-center rounded-full"
      >
        {icon ?? <Sprout className="size-10" aria-hidden />}
      </div>
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="text-muted-foreground max-w-sm">{body}</p>
      {action ?? (
        <Link
          to="/"
          className="bg-primary text-primary-foreground touch-target inline-flex items-center rounded-lg px-5 font-semibold"
        >
          {t('pages.goHome')}
        </Link>
      )}
    </main>
  )
}
