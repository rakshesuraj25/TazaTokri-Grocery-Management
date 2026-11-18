import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type LanguageCode = 'en' | 'mr' | 'hi'

const LANGUAGES: { code: LanguageCode; shortLabel: string; ariaName: string }[] = [
  { code: 'en', shortLabel: 'EN', ariaName: 'English' },
  { code: 'mr', shortLabel: 'मराठी', ariaName: 'मराठी (Marathi)' },
  { code: 'hi', shortLabel: 'हिंदी', ariaName: 'हिंदी (Hindi)' },
]

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const raw = (i18n.language || 'en').split('-')[0]
  const current: LanguageCode = raw === 'mr' || raw === 'hi' ? raw : 'en'

  return (
    <div
      role="radiogroup"
      aria-label={t('common.language')}
      data-testid="language-switcher"
      className={cn(
        'bg-muted border-border inline-flex items-center rounded-lg border p-0.5',
        className
      )}
    >
      {LANGUAGES.map((lang, idx) => {
        const active = current === lang.code
        return (
          <div key={lang.code} className="inline-flex items-center">
            {idx > 0 && (
              <span aria-hidden className="bg-border mx-0.5 h-3.5 w-px shrink-0" />
            )}
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={lang.ariaName}
              onClick={() => void i18n.changeLanguage(lang.code)}
              className={cn(
                'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-xs transition-colors',
                active
                  ? 'bg-card text-primary font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              )}
            >
              {lang.shortLabel}
            </button>
          </div>
        )
      })}
    </div>
  )
}
