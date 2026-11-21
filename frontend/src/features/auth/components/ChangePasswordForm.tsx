import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api'
import { useChangePassword } from '../hooks'

interface ChangePasswordFormProps {
  onSuccess?: () => void
}

function validateNewPassword(currentPassword: string, newPassword: string, confirmPassword: string) {
  if (!currentPassword.trim()) {
    return 'Current password is required.'
  }
  if (newPassword.length < 8 || newPassword.length > 64) {
    return 'New password must be 8 to 64 characters.'
  }
  if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return 'New password must include at least one letter and one number.'
  }
  if (newPassword === currentPassword) {
    return 'New password must be different from your current password.'
  }
  if (confirmPassword !== newPassword) {
    return 'New password and confirmation do not match.'
  }
  return null
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const mutation = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (mutation.isPending) return

    setErrorMsg(null)
    setSuccessMsg(null)

    const validationError = validateNewPassword(currentPassword, newPassword, confirmPassword)
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    try {
      const res = await mutation.mutateAsync({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      const msg = res.message || 'Password updated successfully.'
      setSuccessMsg(msg)
      toast.success(msg)
      onSuccess?.()
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : 'Unable to update password. Please try again.'
      setErrorMsg(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errorMsg && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-xl border px-3 py-2 text-sm font-medium"
        >
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div
          role="status"
          className="bg-primary/10 text-primary border-primary/20 rounded-xl border px-3 py-2 text-sm font-medium"
        >
          {successMsg}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cp-current">Current password</Label>
        <div className="relative">
          <Input
            id="cp-current"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={mutation.isPending}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
          >
            {showCurrent ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cp-new">New password</Label>
        <div className="relative">
          <Input
            id="cp-new"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={mutation.isPending}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? 'Hide new password' : 'Show new password'}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
          >
            {showNew ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        <p className="text-muted-foreground text-xs">
          Use 8 to 64 characters with at least one letter and one number.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cp-confirm">Confirm new password</Label>
        <div className="relative">
          <Input
            id="cp-confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={mutation.isPending}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
          >
            {showConfirm ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </div>

      <Button type="submit" disabled={mutation.isPending} className="rounded-full">
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <KeyRound className="size-4" aria-hidden />
        )}
        {mutation.isPending ? 'Updating...' : 'Update password'}
      </Button>
    </form>
  )
}
