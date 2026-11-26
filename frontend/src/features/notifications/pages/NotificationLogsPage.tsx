import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { toApiError } from '@/lib/api'
import { fmtDate, fmtTime } from '@/lib/dates'
import { ownerNotificationsApi } from '../ownerApi'
import type { NotificationStatus } from '../types'

export default function NotificationLogsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | 'ALL'>('ALL')

  const statusQuery = useQuery({
    queryKey: ['owner', 'notifications', 'status'],
    queryFn: () => ownerNotificationsApi.getStatus(),
  })

  const logsQuery = useQuery({
    queryKey: ['owner', 'notifications', 'logs', statusFilter],
    queryFn: () =>
      ownerNotificationsApi.getLogs(statusFilter === 'ALL' ? undefined : statusFilter),
  })

  const retryMutation = useMutation({
    mutationFn: (logId: number) => ownerNotificationsApi.retry(logId),
    onSuccess: () => {
      toast.success('Notification retried')
      void qc.invalidateQueries({ queryKey: ['owner', 'notifications', 'logs'] })
    },
    onError: (err) => toast.error(toApiError(err).message),
  })

  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data])
  const provider = statusQuery.data

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title="WhatsApp & Order Notifications"
        count={logs.length}
        breadcrumbs={[{ label: 'Team' }, { label: 'Notifications' }]}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void logsQuery.refetch()}
            disabled={logsQuery.isFetching}
          >
            <RefreshCw className={`size-4 ${logsQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
        }
      />

      {/* Provider Config Status (never displays secrets) */}
      {provider && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-secondary text-primary flex size-10 items-center justify-center rounded-xl">
              <ShieldCheck className="size-5" aria-hidden />
            </div>
            <div>
              <p className="font-display text-sm font-bold">
                WhatsApp Business Cloud API
              </p>
              <p className="text-muted-foreground text-xs">
                Shop support: {provider.shopSupportPhone} ·{' '}
                {provider.cloudApiEnabled
                  ? 'Automatic Cloud API dispatch active'
                  : 'Disabled — using manual wa.me fallback'}
              </p>
            </div>
          </div>
          <Badge variant={provider.cloudApiEnabled ? 'success' : 'secondary'}>
            {provider.cloudApiEnabled ? 'Cloud API Active' : 'Manual Fallback'}
          </Badge>
        </Card>
      )}

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['ALL', 'All'],
            ['SENT', 'Sent'],
            ['FAILED', 'Failed'],
            ['PREPARED', 'Manual Prepared'],
            ['SKIPPED_NO_CONSENT', 'No Consent'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={statusFilter === key ? 'default' : 'outline'}
            className="rounded-full text-xs"
            onClick={() => setStatusFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {logsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : logsQuery.isError ? (
        <ErrorState onRetry={() => void logsQuery.refetch()} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-7" aria-hidden />}
          title="No notification logs found"
          description="Order status notifications will appear here once triggered."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Event</th>
                  <th className="px-3 py-2.5">Channel</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Details</th>
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-semibold">#{row.orderId}</td>
                    <td className="px-3 py-2.5 text-xs">{row.eventType.replaceAll('_', ' ')}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {row.channel} ({row.language})
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={
                          row.status === 'SENT'
                            ? 'success'
                            : row.status === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {row.status === 'SENT' && (
                          <CheckCircle2 className="mr-1 size-3" aria-hidden />
                        )}
                        {row.status}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground max-w-[220px] truncate px-3 py-2.5 text-xs">
                      {row.errorDetail ?? '—'}
                    </td>
                    <td className="text-muted-foreground px-3 py-2.5 text-xs">
                      {fmtDate(row.createdAt)} {fmtTime(row.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {row.status === 'FAILED' &&
                        row.channel === 'WHATSAPP_CLOUD_API' &&
                        provider?.cloudApiEnabled && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full text-xs"
                            disabled={retryMutation.isPending}
                            onClick={() => retryMutation.mutate(row.id)}
                          >
                            <RotateCcw className="size-3" aria-hidden />
                            Retry
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
