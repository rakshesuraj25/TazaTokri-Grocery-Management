import { useTranslation } from 'react-i18next'
import { Activity, Database, HardDrive, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useOperationalHealth } from '../hooks'

export function OperationalHealthCard() {
  const { t } = useTranslation()
  const healthQuery = useOperationalHealth()
  const health = healthQuery.data

  if (!health) {
    return null
  }

  return (
    <Card
      data-testid="operational-health-card"
      className="no-print border-border bg-card space-y-3 rounded-2xl border p-4 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="text-primary size-4" aria-hidden />
          <h3 className="font-display text-sm font-bold">
            {t('ops.healthTitle', {
              defaultValue: 'System & Production Operational Health',
            })}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={health.status === 'UP' ? 'success' : 'destructive'}>
            {health.status}
          </Badge>
          <Badge variant="outline">v{health.applicationVersion}</Badge>
          <Badge variant="secondary">{health.environment}</Badge>
        </div>
      </div>

      <div className="bg-surface-subtle grid gap-2.5 rounded-xl p-3 sm:grid-cols-3">
        <div className="flex items-start gap-2">
          <Database className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <span className="text-muted-foreground block text-[11px]">
              {t('ops.databaseStatus', { defaultValue: 'MySQL Database' })}
            </span>
            <span className="font-bold">
              {health.databaseConnected
                ? t('ops.dbConnected', { defaultValue: 'Connected & Healthy' })
                : t('ops.dbDegraded', { defaultValue: 'Connection Issue' })}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <HardDrive className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <span className="text-muted-foreground block text-[11px]">
              {t('ops.lastBackupStatus', { defaultValue: 'Last Database Backup' })}
            </span>
            <span className="font-bold">
              {health.lastBackup.available
                ? `${health.lastBackup.status} (${health.lastBackup.backupFileName ?? ''})`
                : t('ops.backupReady', { defaultValue: 'Script Ready (Not Run Yet)' })}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <span className="text-muted-foreground block text-[11px]">
              {t('ops.storageAndProviders', {
                defaultValue: 'Storage & Optional Providers',
              })}
            </span>
            <div className="mt-0.5 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px]">
                POD: {health.providers.proofStorageProvider}
              </Badge>
              <Badge
                variant={health.providers.whatsappCloudConfigured ? 'success' : 'secondary'}
                className="text-[10px]"
              >
                WA Cloud: {health.providers.whatsappCloudConfigured ? 'ON' : 'OFF'}
              </Badge>
              <Badge
                variant={health.providers.geminiAiConfigured ? 'success' : 'secondary'}
                className="text-[10px]"
              >
                Gemini: {health.providers.geminiAiConfigured ? 'ON' : 'LOCAL'}
              </Badge>
              <Badge
                variant={health.providers.sentryConfigured ? 'success' : 'secondary'}
                className="text-[10px]"
              >
                Sentry: {health.providers.sentryConfigured ? 'ON' : 'OFF'}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
