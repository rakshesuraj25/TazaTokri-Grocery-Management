import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { backupApi, type BackupDashboardResponse } from '@/features/backup/api'
import BackupsPage from '@/features/backup/pages/BackupsPage'

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <BackupsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Backup Management & Restore Readiness', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders backup history, creates backup, verifies, filters, and checks restore readiness', async () => {
    const user = userEvent.setup()

    const dash: BackupDashboardResponse = {
      totalBackups: 2,
      verifiedBackups: 1,
      latestBackup: {
        backupId: '11111111-1111-1111-1111-111111111111',
        backupType: 'MANUAL_SNAPSHOT',
        status: 'COMPLETED',
        fileSizeBytes: 2048,
        sha256Checksum: 'abcd'.repeat(16),
        verificationStatus: 'VERIFIED',
        verificationMessage: 'OK',
        verifiedAt: '2026-11-21T10:00:00',
        createdBy: 1,
        createdAt: '2026-11-21T10:00:00',
        notes: 'Morning snapshot',
      },
      history: [
        {
          backupId: '11111111-1111-1111-1111-111111111111',
          backupType: 'MANUAL_SNAPSHOT',
          status: 'COMPLETED',
          fileSizeBytes: 2048,
          sha256Checksum: 'abcd'.repeat(16),
          verificationStatus: 'VERIFIED',
          verificationMessage: 'OK',
          verifiedAt: '2026-11-21T10:00:00',
          createdBy: 1,
          createdAt: '2026-11-21T10:00:00',
          notes: 'Morning snapshot',
        },
        {
          backupId: '22222222-2222-2222-2222-222222222222',
          backupType: 'MANUAL_SNAPSHOT',
          status: 'FAILED',
          fileSizeBytes: 0,
          sha256Checksum: null,
          verificationStatus: 'FAILED',
          verificationMessage: 'Disk full',
          verifiedAt: null,
          createdBy: 1,
          createdAt: '2026-11-20T10:00:00',
          notes: 'Failed attempt',
        },
      ],
    }

    vi.spyOn(backupApi, 'getDashboard').mockResolvedValue(dash)
    const createSpy = vi.spyOn(backupApi, 'createBackup').mockResolvedValue({
      ...dash.latestBackup!,
      backupId: '33333333-3333-3333-3333-333333333333',
      notes: 'Before EOD',
    })
    const verifySpy = vi.spyOn(backupApi, 'verifyBackup').mockResolvedValue(dash.latestBackup!)
    const readinessSpy = vi.spyOn(backupApi, 'getReadiness').mockResolvedValue({
      backupId: '11111111-1111-1111-1111-111111111111',
      valid: true,
      status: 'COMPLETED',
      verificationStatus: 'VERIFIED',
      compatibility: 'TazaTokri Snapshot Format v1.0',
      warningMessage: 'WARNING: Restoring overwrites current records.',
      prerequisites: ['Pause store orders', 'Verify checksum'],
      manualRestoreOnly: true,
    })

    renderPage()

    expect(await screen.findByText('11111111')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()

    // Create backup
    await user.type(screen.getByPlaceholderText(/optional backup note/i), 'Before EOD')
    await user.click(screen.getByRole('button', { name: /create backup/i }))
    await waitFor(() => expect(createSpy).toHaveBeenCalledWith('Before EOD'))

    // Verify first backup
    await user.click(screen.getAllByRole('button', { name: /verify/i })[0])
    await waitFor(() =>
      expect(verifySpy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111'),
    )

    // Restore readiness
    await user.click(screen.getAllByRole('button', { name: /restore readiness/i })[0])
    await waitFor(() =>
      expect(readinessSpy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111'),
    )
    expect(await screen.findByText(/warning: restoring overwrites/i)).toBeInTheDocument()
    expect(screen.getByText(/pause store orders/i)).toBeInTheDocument()

    // Filter by COMPLETED
    await user.selectOptions(screen.getByLabelText(/filter by backup status/i), 'COMPLETED')
    expect(screen.queryByText('22222222')).not.toBeInTheDocument()
    expect(screen.getByText('11111111')).toBeInTheDocument()
  })

  it('shows error and empty states cleanly', async () => {
    vi.spyOn(backupApi, 'getDashboard').mockRejectedValueOnce(new Error('Backup API error'))
    renderPage()
    expect(await screen.findByText(/backup api error/i)).toBeInTheDocument()

    vi.spyOn(backupApi, 'getDashboard').mockResolvedValueOnce({
      totalBackups: 0,
      verifiedBackups: 0,
      latestBackup: null,
      history: [],
    })
    renderPage()
    expect(await screen.findByText(/no backups found/i)).toBeInTheDocument()
  })
})
