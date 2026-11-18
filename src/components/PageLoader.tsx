import { useTranslation } from 'react-i18next'

/** Full-page skeleton shown while a lazy route chunk loads. */
export function PageLoader() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4" role="status" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="skeleton h-8 w-1/3" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-40" />
        ))}
      </div>
    </div>
  )
}
