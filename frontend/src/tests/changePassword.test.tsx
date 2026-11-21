import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'
import { authApi } from '@/features/auth/api'
import { ApiRequestError } from '@/lib/api'

function renderForm() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ChangePasswordForm />
    </QueryClientProvider>,
  )
}

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('validates complexity, same-password, and confirmation mismatch client-side', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(authApi, 'changePassword')
    renderForm()

    await user.type(screen.getByLabelText('Current password'), 'OldPass123')
    await user.type(screen.getByLabelText('New password'), 'short1')
    await user.type(screen.getByLabelText('Confirm new password'), 'short1')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/8 to 64 characters/i)
    expect(spy).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('New password'))
    await user.clear(screen.getByLabelText('Confirm new password'))
    await user.type(screen.getByLabelText('New password'), 'NewPass123')
    await user.type(screen.getByLabelText('Confirm new password'), 'Different123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i)
    expect(spy).not.toHaveBeenCalled()
  })

  it('submits, clears fields, and shows success message on API success', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(authApi, 'changePassword').mockResolvedValue({
      message: 'Password updated successfully',
    })
    renderForm()

    await user.type(screen.getByLabelText('Current password'), 'OldPass123')
    await user.type(screen.getByLabelText('New password'), 'NewPass123')
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPass123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Password updated successfully/i)
    })
    expect(spy).toHaveBeenCalledWith({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
    })
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('')
  })

  it('displays API error message when current password is rejected', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'changePassword').mockRejectedValue(
      new ApiRequestError({ status: 400, message: 'Current password is incorrect' }),
    )
    renderForm()

    await user.type(screen.getByLabelText('Current password'), 'WrongPass1')
    await user.type(screen.getByLabelText('New password'), 'NewPass123')
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPass123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Current password is incorrect/i)
    })
  })
})
