import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  HardDrive,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { StatGridSkeleton } from '@/components/Skeletons'
import { toApiError } from '@/lib/api'
import { fmtDateTime } from '@/lib/dates'
import {
  backupApi,
  useBackupDashboard,
  useCreateBackup,
  useVerifyBackup,
  type BackupRecord,
  type BackupStatus,
  type BackupVerificationStatus,
  type RestoreReadinessResponse,
} from '../api'

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function BackupsPage() {
  const dashboard = useBackupDashboard()
  const createBackup = useCreateBackup()
  const verifyBackup = useVerifyBackup()

  const [notes, setNotes] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | BackupStatus>('ALL')
  const [verifyFilter, setVerifyFilter] = useState<'ALL' | BackupVerificationStatus>('ALL')
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'LARGEST'>('NEWEST')
  const [readiness, setReadiness] = useState<RestoreReadinessResponse | null>(null)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const filteredHistory = useMemo(() => {
    const items = dashboard.data?.history ?? []
    return items
      .filter((b) => {
        if (statusFilter !== 'ALL' && b.status !== statusFilter) return false
        if (verifyFilter !== 'ALL' && b.verificationStatus !== verifyFilter) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'LARGEST') return b.fileSizeBytes - a.fileSizeBytes
        if (sortBy === 'OLDEST') return a.createdAt.localeCompare(b.createdAt)
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [dashboard.data, statusFilter, verifyFilter, sortBy])

  async function handleCreate() {
    setActionError(null)
    try {
      const created = await createBackup.mutateAsync(notes)
      toast.success(`Backup created & verified (${formatBytes(created.fileSizeBytes)})`)
      setNotes('')
    } catch (err) {
      setActionError(toApiError(err).message)
    }
  }

  async function handleVerify(b: BackupRecord) {
    setActionError(null)
    try {
      const res = await verifyBackup.mutateAsync(b.backupId)
      if (res.verificationStatus === 'VERIFIED') {
        toast.success('Backup integrity verified')
      } else {
        toast.error(res.verificationMessage || 'Backup verification failed')
      }
    } catch (err) {
      setActionError(toApiError(err).message)
    }
  }

  async function handleCheckReadiness(backupId: string) {
    setReadinessError(null)
    try {
      const res = await backupApi.getReadiness(backupId)
      setReadiness(res)
    } catch (err) {
      setReadinessError(toApiError(err).message)
    }
  }

  async function handleDownload(backupId: string) {
    setActionError(null)
    try {
      await backupApi.downloadBackup(backupId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  const d = dashboard.data
  const latest = d?.latestBackup ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title="Backup & Restore Readiness"
        breadcrumbs={[{ label: 'Owner' }, { label: 'Backups' }]}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void dashboard.refetch()}
          >
            <RefreshCw className="size-4" /> Refresh
          </Button>
        }
      />

      {dashboard.isLoading ? (
        <StatGridSkeleton count={4} />
      ) : dashboard.isError || !d ? (
        <ErrorState
          message={dashboard.error ? toApiError(dashboard.error).message : 'Failed to load backups'}
          onRetry={() => void dashboard.refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total Backups" value={d.totalBackups} />
            <Stat label="Verified Backups" value={d.verifiedBackups} tone="positive" />
            <Stat
              label="Latest Backup"
              value={latest ? fmtDateTime(latest.createdAt) : 'None'}
              hint={latest ? `Status: ${latest.status}` : 'Create your first backup'}
            />
            <Stat
              label="Latest Size & Check"
              value={latest ? formatBytes(latest.fileSizeBytes) : '—'}
              hint={latest ? `Integrity: ${latest.verificationStatus}` : undefined}
            />
          </div>

          <Card className="rounded-3xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <DatabaseBackup className="size-4" /> Create Manual Snapshot Backup
                </h2>
                <p className="text-muted-foreground text-xs">
                  Generates a read-only JSON/ZIP snapshot (excluding credentials &amp; secrets) and
                  verifies its SHA-256 checksum before marking complete.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional backup note..."
                  className="w-60"
                />
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={createBackup.isPending}
                  onClick={handleCreate}
                >
                  <HardDrive className="size-4" />
                  {createBackup.isPending ? 'Creating & Verifying...' : 'Create Backup'}
                </Button>
              </div>
            </div>
            {actionError && (
              <p role="alert" className="text-destructive mt-3 text-sm font-medium">
                {actionError}
              </p>
            )}
          </Card>

          {readinessError && (
            <p role="alert" className="text-destructive text-sm font-medium">
              {readinessError}
            </p>
          )}

          {readiness && (
            <Card className="border-amber-500/40 rounded-3xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <AlertTriangle className="size-4 text-amber-600" />
                    Restore Readiness: {readiness.backupId.slice(0, 8)}...
                  </h3>
                  <p className="text-muted-foreground text-xs">{readiness.compatibility}</p>
                </div>
                <Badge variant={readiness.valid ? 'default' : 'destructive'}>
                  {readiness.valid ? 'Ready for Manual Restore' : 'Not Ready'}
                </Badge>
              </div>
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-900">
                {readiness.warningMessage}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {readiness.prerequisites.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="rounded-3xl border">
            <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base">Backup History</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by backup status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'ALL' | BackupStatus)}
                  className="border-input bg-background h-9 rounded-full border px-3 text-xs"
                >
                  <option value="ALL">All Status</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                  <option value="PENDING">Pending</option>
                </select>
                <select
                  aria-label="Filter by verification"
                  value={verifyFilter}
                  onChange={(e) =>
                    setVerifyFilter(e.target.value as 'ALL' | BackupVerificationStatus)
                  }
                  className="border-input bg-background h-9 rounded-full border px-3 text-xs"
                >
                  <option value="ALL">All Verification</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="FAILED">Failed</option>
                  <option value="PENDING">Pending</option>
                </select>
                <select
                  aria-label="Sort backups"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'NEWEST' | 'OLDEST' | 'LARGEST')}
                  className="border-input bg-background h-9 rounded-full border px-3 text-xs"
                >
                  <option value="NEWEST">Newest First</option>
                  <option value="OLDEST">Oldest First</option>
                  <option value="LARGEST">Largest Size</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredHistory.length === 0 ? (
                <EmptyState
                  title="No backups found"
                  description="Create a manual snapshot backup to get started."
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredHistory.map((b) => (
                    <div
                      key={b.backupId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold">{b.backupId.slice(0, 8)}</span>
                          <Badge variant={b.status === 'COMPLETED' ? 'default' : 'destructive'}>
                            {b.status}
                          </Badge>
                          <Badge
                            variant={
                              b.verificationStatus === 'VERIFIED' ? 'secondary' : 'destructive'
                            }
                          >
                            {b.verificationStatus === 'VERIFIED' && (
                              <CheckCircle2 className="mr-1 size-3" />
                            )}
                            {b.verificationStatus}
                          </Badge>
                          <Badge variant="outline">{b.backupType.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {fmtDateTime(b.createdAt)} · Size: {formatBytes(b.fileSizeBytes)}
                          {b.notes ? ` · ${b.notes}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full text-xs"
                          onClick={() => handleVerify(b)}
                          disabled={verifyBackup.isPending}
                        >
                          <ShieldCheck className="size-3.5" /> Verify
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full text-xs"
                          onClick={() => handleCheckReadiness(b.backupId)}
                        >
                          Restore Readiness
                        </Button>
                        {b.status === 'COMPLETED' && b.verificationStatus === 'VERIFIED' && (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-full text-xs"
                            onClick={() => handleDownload(b.backupId)}
                          >
                            <Download className="size-3.5" /> Download
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
