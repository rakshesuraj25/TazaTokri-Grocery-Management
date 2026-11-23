import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toApiError } from '@/lib/api'
import { authApi } from '../api'
import { AuthBrandPanel } from '../components/AuthBrandPanel'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [phone, setPhone] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = phone.trim()
    if (!/^[6-9]\d{9}$/.test(trimmed)) {
      setError('Enter a valid 10-digit Indian mobile number')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.forgotPassword({ phone: trimmed })
      setResetToken(res.resetToken)
      setInfoMessage(res.message)
      setDevOtpHint(res.devOtp ?? null)
      setStep('reset')
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Verification code must be 6 digits')
      return
    }
    if (newPassword.length < 8 || newPassword.length > 64 || !/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword)) {
      setError('Password must be 8–64 characters and include at least one letter and one number')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.resetPassword({
        phone: phone.trim(),
        otp: otp.trim(),
        resetToken,
        newPassword,
      })
      toast.success(res.message)
      navigate(`/login?phone=${encodeURIComponent(phone.trim())}`)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center px-4 py-8">
      <div className="grid w-full items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <AuthBrandPanel />

        <div className="mx-auto flex w-full max-w-md flex-col justify-center">
          <Card className="p-1 sm:p-2">
            <CardHeader className="items-center text-center">
              <div className="bg-secondary mb-1 flex size-14 items-center justify-center rounded-full">
                <LogoMark size="md" decorative />
              </div>
              <CardTitle className="font-organic flex items-center gap-2 text-2xl">
                <KeyRound className="size-5" aria-hidden />
                Reset Password
              </CardTitle>
              <CardDescription>
                {step === 'request'
                  ? 'Enter your registered mobile number to receive a 6-digit verification code.'
                  : 'Enter the 6-digit verification code and choose a new password.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="bg-tomato-light text-tomato flex items-center gap-2 rounded-lg p-3 text-sm font-medium"
                >
                  <AlertCircle className="size-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              {infoMessage && (
                <div className="bg-secondary/60 text-foreground flex items-start gap-2 rounded-lg p-3 text-xs">
                  <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                  <div>
                    <p>{infoMessage}</p>
                    {devOtpHint && (
                      <p className="text-muted-foreground mt-1 font-mono">
                        Dev verification code: <strong>{devOtpHint}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 'request' ? (
                <form onSubmit={handleRequestReset} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-phone">Mobile number</Label>
                    <Input
                      id="forgot-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full rounded-full" loading={loading}>
                    Send Verification Code
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-otp">6-digit verification code</Label>
                    <Input
                      id="reset-otp"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reset-new-password">New password</Label>
                    <div className="relative">
                      <Input
                        id="reset-new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 8 chars with letter & number"
                        className="pr-11"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="touch-target text-muted-foreground hover:text-foreground absolute top-0 right-0 inline-flex items-center justify-center"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reset-confirm-password">Confirm new password</Label>
                    <Input
                      id="reset-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setStep('request')
                        setError(null)
                      }}
                    >
                      Back
                    </Button>
                    <Button type="submit" className="flex-1 rounded-full" loading={loading}>
                      Reset Password
                    </Button>
                  </div>
                </form>
              )}

              <p className="text-muted-foreground text-center text-sm">
                <Link
                  to="/login"
                  className="text-primary inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Back to Login
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
