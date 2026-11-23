import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Mail, Phone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toApiError } from '@/lib/api'
import { accountApi } from '../api'
import { useAuthStore } from '../store'
import { normalizeRoles } from '../roles'

export function AccountSecuritySection() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)

  const [currentEmail, setCurrentEmail] = useState<string | null>(null)

  // Change phone state
  const [phoneStep, setPhoneStep] = useState<'request' | 'confirm'>('request')
  const [newPhone, setNewPhone] = useState('')
  const [phonePassword, setPhonePassword] = useState('')
  const [phoneChallengeToken, setPhoneChallengeToken] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneDevOtp, setPhoneDevOtp] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneLoading, setPhoneLoading] = useState(false)

  // Change email state
  const [emailStep, setEmailStep] = useState<'request' | 'confirm'>('request')
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailChallengeToken, setEmailChallengeToken] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [emailDevOtp, setEmailDevOtp] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  // Delete account state
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    let active = true
    accountApi
      .getProfile()
      .then((profile) => {
        if (active) setCurrentEmail(profile.email)
      })
      .catch(() => {
        // Non-blocking profile fetch
      })
    return () => {
      active = false
    }
  }, [])

  const handleRequestPhoneVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhoneError(null)
    const trimmed = newPhone.trim()
    if (!/^[6-9]\d{9}$/.test(trimmed)) {
      setPhoneError('Enter a valid 10-digit Indian mobile number')
      return
    }
    if (!phonePassword) {
      setPhoneError('Current password is required')
      return
    }
    setPhoneLoading(true)
    try {
      const res = await accountApi.requestPhoneVerification({
        newPhone: trimmed,
        currentPassword: phonePassword,
      })
      setPhoneChallengeToken(res.challengeToken)
      setPhoneDevOtp(res.devOtp ?? null)
      setPhoneStep('confirm')
      toast.info(res.message)
    } catch (err) {
      setPhoneError(toApiError(err).message)
    } finally {
      setPhoneLoading(false)
    }
  }

  const handleConfirmPhoneChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhoneError(null)
    if (!/^\d{6}$/.test(phoneOtp.trim())) {
      setPhoneError('Verification code must be 6 digits')
      return
    }
    setPhoneLoading(true)
    try {
      const res = await accountApi.confirmPhoneChange({
        newPhone: newPhone.trim(),
        otp: phoneOtp.trim(),
        challengeToken: phoneChallengeToken,
      })
      setUser(
        {
          userId: res.user.id,
          fullName: res.user.fullName,
          phone: res.user.phone,
          roles: normalizeRoles(res.user.roles),
          expiresInMinutes: res.expiresInMinutes,
        },
        res.token,
      )
      toast.success(res.message)
      setPhoneStep('request')
      setNewPhone('')
      setPhonePassword('')
      setPhoneOtp('')
      setPhoneChallengeToken('')
      setPhoneDevOtp(null)
    } catch (err) {
      setPhoneError(toApiError(err).message)
    } finally {
      setPhoneLoading(false)
    }
  }

  const handleRequestEmailVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    const trimmed = newEmail.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError('Enter a valid email address')
      return
    }
    if (!emailPassword) {
      setEmailError('Current password is required')
      return
    }
    setEmailLoading(true)
    try {
      const res = await accountApi.requestEmailVerification({
        newEmail: trimmed,
        currentPassword: emailPassword,
      })
      setEmailChallengeToken(res.challengeToken)
      setEmailDevOtp(res.devOtp ?? null)
      setEmailStep('confirm')
      toast.info(res.message)
    } catch (err) {
      setEmailError(toApiError(err).message)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    if (!/^\d{6}$/.test(emailOtp.trim())) {
      setEmailError('Verification code must be 6 digits')
      return
    }
    setEmailLoading(true)
    try {
      const res = await accountApi.confirmEmailChange({
        newEmail: newEmail.trim(),
        otp: emailOtp.trim(),
        challengeToken: emailChallengeToken,
      })
      setCurrentEmail(res.user.email)
      toast.success(res.message)
      setEmailStep('request')
      setNewEmail('')
      setEmailPassword('')
      setEmailOtp('')
      setEmailChallengeToken('')
      setEmailDevOtp(null)
    } catch (err) {
      setEmailError(toApiError(err).message)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteError(null)
    if (!deletePassword) {
      setDeleteError('Current password is required')
      return
    }
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm account deletion')
      return
    }
    setDeleteLoading(true)
    try {
      const res = await accountApi.deleteAccount({
        currentPassword: deletePassword,
        confirmation: deleteConfirmText.trim(),
      })
      toast.success(res.message)
      logout()
      navigate('/login')
    } catch (err) {
      setDeleteError(toApiError(err).message)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Change Mobile Number */}
      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              <Phone className="size-4" aria-hidden />
              Change Mobile Number
            </h3>
            <p className="text-muted-foreground text-xs">
              Current mobile: <strong>{user?.phone ?? '—'}</strong>
            </p>
          </div>
        </div>

        {phoneError && (
          <p role="alert" className="text-destructive text-xs font-medium">
            {phoneError}
          </p>
        )}

        {phoneStep === 'request' ? (
          <form onSubmit={handleRequestPhoneVerification} className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="new-phone" className="text-xs">
                New mobile number
              </Label>
              <Input
                id="new-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="phone-current-password" className="text-xs">
                Current password
              </Label>
              <Input
                id="phone-current-password"
                type="password"
                placeholder="Verify password"
                value={phonePassword}
                onChange={(e) => setPhonePassword(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm" className="w-full rounded-full" loading={phoneLoading}>
                Send Verification Code
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmPhoneChange} className="space-y-2.5">
            {phoneDevOtp && (
              <p className="text-muted-foreground text-xs font-mono">
                Dev verification code: <strong>{phoneDevOtp}</strong>
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label htmlFor="phone-otp" className="text-xs">
                  6-digit code for {newPhone}
                </Label>
                <Input
                  id="phone-otp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setPhoneStep('request')
                    setPhoneOtp('')
                    setPhoneError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="flex-1 rounded-full" loading={phoneLoading}>
                  Verify & Update
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>

      {/* Change Email */}
      <Card className="space-y-3 p-4 sm:p-5">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <Mail className="size-4" aria-hidden />
            Change Email Address
          </h3>
          <p className="text-muted-foreground text-xs">
            Current email: <strong>{currentEmail ?? 'Not set'}</strong>
          </p>
        </div>

        {emailError && (
          <p role="alert" className="text-destructive text-xs font-medium">
            {emailError}
          </p>
        )}

        {emailStep === 'request' ? (
          <form onSubmit={handleRequestEmailVerification} className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="new-email" className="text-xs">
                New email address
              </Label>
              <Input
                id="new-email"
                type="email"
                placeholder="name@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email-current-password" className="text-xs">
                Current password
              </Label>
              <Input
                id="email-current-password"
                type="password"
                placeholder="Verify password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm" className="w-full rounded-full" loading={emailLoading}>
                Send Verification Code
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmEmailChange} className="space-y-2.5">
            {emailDevOtp && (
              <p className="text-muted-foreground text-xs font-mono">
                Dev verification code: <strong>{emailDevOtp}</strong>
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label htmlFor="email-otp" className="text-xs">
                  6-digit code for {newEmail}
                </Label>
                <Input
                  id="email-otp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setEmailStep('request')
                    setEmailOtp('')
                    setEmailError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="flex-1 rounded-full" loading={emailLoading}>
                  Verify & Update
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/40 space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <h3 className="text-destructive text-sm font-bold">Delete Account</h3>
            <p className="text-muted-foreground text-xs">
              Deactivates your login and anonymizes your personal details. Historical orders, payments, and business records are safely preserved.
            </p>
          </div>
        </div>

        {deleteError && (
          <p role="alert" className="text-destructive text-xs font-medium">
            {deleteError}
          </p>
        )}

        <form onSubmit={handleDeleteAccount} className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="delete-password" className="text-xs">
              Current password
            </Label>
            <Input
              id="delete-password"
              type="password"
              placeholder="Enter password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="delete-confirm" className="text-xs">
              Type DELETE to confirm
            </Label>
            <Input
              id="delete-confirm"
              placeholder="DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              className="w-full rounded-full"
              loading={deleteLoading}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete Account
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
