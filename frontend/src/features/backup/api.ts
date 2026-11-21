import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type BackupStatus = 'PENDING' | 'COMPLETED' | 'FAILED'
export type BackupVerificationStatus = 'PENDING' | 'VERIFIED' | 'FAILED'
export type BackupType = 'MANUAL_SNAPSHOT'

export interface BackupRecord {
  backupId: string
  backupType: BackupType
  status: BackupStatus
  fileSizeBytes: number
  sha256Checksum: string | null
  verificationStatus: BackupVerificationStatus
  verificationMessage: string | null
  verifiedAt: string | null
  createdBy: number
  createdAt: string
  notes: string | null
}

export interface BackupDashboardResponse {
  totalBackups: number
  verifiedBackups: number
  latestBackup: BackupRecord | null
  history: BackupRecord[]
}

export interface RestoreReadinessResponse {
  backupId: string
  valid: boolean
  status: BackupStatus
  verificationStatus: BackupVerificationStatus
  compatibility: string
  warningMessage: string
  prerequisites: string[]
  manualRestoreOnly: boolean
}

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export const backupApi = {
  getDashboard: () => api.get<BackupDashboardResponse>('/api/backups'),
  createBackup: (notes?: string) =>
    api.post<BackupRecord>('/api/backups', { notes: notes?.trim() || null }),
  verifyBackup: (backupId: string) =>
    api.post<BackupRecord>(`/api/backups/${encodeURIComponent(backupId)}/verify`, {}),
  getReadiness: (backupId: string) =>
    api.get<RestoreReadinessResponse>(`/api/backups/${encodeURIComponent(backupId)}/readiness`),
  downloadBackup: async (backupId: string): Promise<void> => {
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${BASE_URL}/api/backups/${encodeURIComponent(backupId)}/download`, {
      headers,
    })
    if (!res.ok) {
      throw new Error(`Download failed (HTTP ${res.status})`)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tazatokri-backup-${backupId.slice(0, 8)}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}

export const backupKeys = {
  all: ['backups'] as const,
  dashboard: () => [...backupKeys.all, 'dashboard'] as const,
  readiness: (id: string) => [...backupKeys.all, 'readiness', id] as const,
}

export function useBackupDashboard() {
  return useQuery({
    queryKey: backupKeys.dashboard(),
    queryFn: () => backupApi.getDashboard(),
  })
}

export function useCreateBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notes?: string) => backupApi.createBackup(notes),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: backupKeys.all })
    },
  })
}

export function useVerifyBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (backupId: string) => backupApi.verifyBackup(backupId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: backupKeys.all })
    },
  })
}
