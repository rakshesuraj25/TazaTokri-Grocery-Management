import { useTranslation } from 'react-i18next'
import { MessageCircle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { fmtDateTime } from '@/lib/dates'
import { toApiError } from '@/lib/api'
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../hooks'
import type { NotificationLanguage } from '../types'

const LANGUAGES: Array<{ code: NotificationLanguage; label: string }> = [
  { code: 'EN', label: 'English' },
  { code: 'MR', label: 'मराठी' },
  { code: 'HI', label: 'हिंदी' },
]

export function NotificationPreferencesCard() {
  const { t } = useTranslation()
  const prefsQuery = useNotificationPreferences()
  const updatePrefs = useUpdateNotificationPreferences()

  const prefs = prefsQuery.data
  const optIn = Boolean(prefs?.whatsappOptIn)
  const currentLang: NotificationLanguage = prefs?.preferredLanguage ?? 'EN'

  const handleToggleOptIn = (nextOptIn: boolean) => {
    updatePrefs.mutate(
      {
        whatsappOptIn: nextOptIn,
        preferredLanguage: currentLang,
      },
      {
        onSuccess: () => {
          toast.success(
            nextOptIn
              ? t('notifications.optInSaved', {
                  defaultValue: 'WhatsApp order notifications enabled',
                })
              : t('notifications.optOutSaved', {
                  defaultValue: 'WhatsApp order notifications disabled',
                }),
          )
        },
        onError: (err) => toast.error(toApiError(err).message),
      },
    )
  }

  const handleSelectLanguage = (lang: NotificationLanguage) => {
    updatePrefs.mutate(
      {
        whatsappOptIn: optIn,
        preferredLanguage: lang,
      },
      {
        onSuccess: () => {
          toast.success(
            t('notifications.languageSaved', {
              defaultValue: 'Notification language updated',
            }),
          )
        },
        onError: (err) => toast.error(toApiError(err).message),
      },
    )
  }

  return (
    <Card className="space-y-4 p-5" data-testid="notification-preferences-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-primary size-5" aria-hidden />
            <h2 className="font-display text-lg font-bold">
              {t('notifications.title', { defaultValue: 'WhatsApp Order Notifications' })}
            </h2>
            <Badge variant={optIn ? 'default' : 'secondary'}>
              {optIn
                ? t('notifications.optedInBadge', { defaultValue: 'Opted in' })
                : t('notifications.optedOutBadge', { defaultValue: 'Opted out' })}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t('notifications.description', {
              defaultValue:
                'Receive order confirmation, packing, and delivery updates on WhatsApp. You can opt out anytime.',
            })}
          </p>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <span>
            {optIn
              ? t('notifications.enabled', { defaultValue: 'Enabled' })
              : t('notifications.disabled', { defaultValue: 'Disabled' })}
          </span>
          <Switch
            checked={optIn}
            disabled={updatePrefs.isPending}
            onCheckedChange={handleToggleOptIn}
            aria-label={t('notifications.toggleAria', {
              defaultValue: 'Enable WhatsApp notifications',
            })}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold">
            {t('notifications.preferredLanguage', {
              defaultValue: 'Preferred message language',
            })}
          </p>
          {prefs?.consentTimestamp && (
            <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <ShieldCheck className="size-3.5" aria-hidden />
              {t('notifications.consentRecordedAt', {
                date: fmtDateTime(prefs.consentTimestamp),
                defaultValue: `Consent updated: ${fmtDateTime(prefs.consentTimestamp)}`,
              })}
            </p>
          )}
        </div>

        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label={t('notifications.preferredLanguage', {
            defaultValue: 'Preferred message language',
          })}
        >
          {LANGUAGES.map((l) => {
            const active = currentLang === l.code
            return (
              <Button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={active}
                size="sm"
                variant={active ? 'default' : 'outline'}
                disabled={updatePrefs.isPending}
                onClick={() => handleSelectLanguage(l.code)}
                className="rounded-full"
              >
                {l.label}
              </Button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
