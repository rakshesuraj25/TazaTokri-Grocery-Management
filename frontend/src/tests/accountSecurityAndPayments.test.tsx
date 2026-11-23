import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { accountApi, authApi } from '@/features/auth/api'
import { useAuthStore } from '@/features/auth/store'
import LoginPage from '@/features/auth/pages/LoginPage'
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage'
import { AccountSecuritySection } from '@/features/auth/components/AccountSecuritySection'

function withProviders(ui: React.ReactNode, initialPath = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Phase 4 Account Security UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({
      user: {
        userId: 10,
        fullName: 'Asha Patil',
        phone: '9876543210',
        roles: ['CUSTOMER'],
      },
      activeRole: 'CUSTOMER',
      isHydrated: true,
    })
  })

  it('renders forgot-password link on LoginPage and completes forgot/reset password flow', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'forgotPassword').mockResolvedValueOnce({
      message: 'If an active account exists for this mobile number, a verification code has been issued.',
      resetToken: 'signed-reset-token',
      expiresInMinutes: 15,
      devOtp: '654321',
    })
    const resetSpy = vi.spyOn(authApi, 'resetPassword').mockResolvedValueOnce({
      message: 'Password has been reset successfully.',
    })

    withProviders(<LoginPage />, '/login')
    const forgotLink = screen.getByRole('link', { name: /forgot password/i })
    await user.click(forgotLink)

    expect(await screen.findByRole('heading', { name: /reset password/i })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/mobile number/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /send verification code/i }))

    expect(await screen.findByText(/654321/)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/6-digit verification code/i), '654321')
    await user.type(screen.getByLabelText(/^new password$/i), 'NewPass123')
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPass123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() =>
      expect(resetSpy).toHaveBeenCalledWith({
        phone: '9876543210',
        otp: '654321',
        resetToken: 'signed-reset-token',
        newPassword: 'NewPass123',
      }),
    )
  })

  it('supports verified mobile change, verified email change, and account deletion', async () => {
    const user = userEvent.setup()
    vi.spyOn(accountApi, 'getProfile').mockResolvedValue({
      id: 10,
      fullName: 'Asha Patil',
      phone: '9876543210',
      email: 'asha@example.com',
      roles: ['CUSTOMER'],
    })
    vi.spyOn(accountApi, 'requestPhoneVerification').mockResolvedValueOnce({
      message: 'Verification code issued for ******0001.',
      challengeToken: 'phone-token',
      maskedTarget: '******0001',
      expiresInMinutes: 10,
      devOtp: '112233',
    })
    vi.spyOn(accountApi, 'confirmPhoneChange').mockResolvedValueOnce({
      message: 'Mobile number updated successfully',
      user: {
        id: 10,
        fullName: 'Asha Patil',
        phone: '9876500001',
        email: 'asha@example.com',
        roles: ['CUSTOMER'],
      },
      token: 'fresh-jwt-token',
      expiresInMinutes: 60,
    })
    vi.spyOn(accountApi, 'requestEmailVerification').mockResolvedValueOnce({
      message: 'Verification code issued.',
      challengeToken: 'email-token',
      maskedTarget: 'n***@example.com',
      expiresInMinutes: 10,
      devOtp: '445566',
    })
    vi.spyOn(accountApi, 'confirmEmailChange').mockResolvedValueOnce({
      message: 'Email updated successfully',
      user: {
        id: 10,
        fullName: 'Asha Patil',
        phone: '9876500001',
        email: 'new@example.com',
        roles: ['CUSTOMER'],
      },
    })
    const deleteSpy = vi.spyOn(accountApi, 'deleteAccount').mockResolvedValueOnce({
      message: 'Account deleted successfully.',
    })

    withProviders(<AccountSecuritySection />, '/')

    // Change phone
    await user.type(screen.getByLabelText(/new mobile number/i), '9876500001')
    await user.type(screen.getByLabelText(/current password/i, { selector: '#phone-current-password' }), 'Secret123')
    const sendButtons = screen.getAllByRole('button', { name: /send verification code/i })
    await user.click(sendButtons[0])

    await user.type(await screen.findByLabelText(/6-digit code for 9876500001/i), '112233')
    await user.click(screen.getByRole('button', { name: /verify & update/i }))
    await waitFor(() => expect(useAuthStore.getState().user?.phone).toBe('9876500001'))

    // Change email
    await user.type(screen.getByLabelText(/new email address/i), 'new@example.com')
    await user.type(screen.getByLabelText(/current password/i, { selector: '#email-current-password' }), 'Secret123')
    await user.click(screen.getAllByRole('button', { name: /send verification code/i })[1])

    await user.type(await screen.findByLabelText(/6-digit code for new@example.com/i), '445566')
    await user.click(screen.getByRole('button', { name: /verify & update/i }))
    await waitFor(() => expect(screen.getByText('new@example.com')).toBeInTheDocument())

    // Delete account
    await user.type(screen.getByLabelText(/current password/i, { selector: '#delete-password' }), 'Secret123')
    await user.type(screen.getByLabelText(/type delete to confirm/i), 'DELETE')
    await user.click(screen.getByRole('button', { name: /delete account/i }))

    await waitFor(() =>
      expect(deleteSpy).toHaveBeenCalledWith({
        currentPassword: 'Secret123',
        confirmation: 'DELETE',
      }),
    )
    expect(useAuthStore.getState().user).toBeNull()
  })
})
