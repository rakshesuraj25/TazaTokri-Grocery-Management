import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toApiError } from '@/lib/api'
import { AuthBrandPanel } from '../components/AuthBrandPanel'
import { useSignup } from '../hooks'
import { signupSchema, type SignupForm } from '../schemas'

export default function SignupPage() {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const signup = useSignup()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', phone: '', password: '', confirmPassword: '' },
  })

  const onSubmit = (values: SignupForm) => {
    signup.mutate(
      { fullName: values.fullName.trim(), phone: values.phone, password: values.password },
      {
        onError: (err) => {
          const apiErr = toApiError(err)
          if (apiErr.fieldErrors) {
            for (const [field, msg] of Object.entries(apiErr.fieldErrors)) {
              if (field === 'fullName' || field === 'phone' || field === 'password') {
                setError(field, { message: msg })
              }
            }
          }
        },
      },
    )
  }

  const serverError = signup.error ? toApiError(signup.error) : null

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
              <CardTitle className="font-organic text-2xl">{t('auth.signup')}</CardTitle>
              <CardDescription>{t('auth.signupSubtitle')}</CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {serverError && (
              <div
                role="alert"
                aria-live="assertive"
                className="bg-tomato-light text-tomato flex items-center gap-2 rounded-lg p-3 text-sm font-medium"
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                <span>
                  {serverError.status === 0 ? t('errors.network') : serverError.message}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="signup-name">{t('auth.fullName')}</Label>
              <Input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder={t('auth.namePlaceholder')}
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? 'signup-name-error' : undefined}
                {...register('fullName')}
              />
              {errors.fullName?.message && (
                <p id="signup-name-error" role="alert" className="text-destructive text-xs font-medium">
                  {t(errors.fullName.message, { defaultValue: errors.fullName.message })}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-phone">{t('auth.phone')}</Label>
              <Input
                id="signup-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder={t('auth.phonePlaceholder')}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'signup-phone-error' : undefined}
                {...register('phone')}
              />
              {errors.phone?.message && (
                <p id="signup-phone-error" role="alert" className="text-destructive text-xs font-medium">
                  {t(errors.phone.message, { defaultValue: errors.phone.message })}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('auth.passwordPlaceholder')}
                  className="pr-11"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'signup-password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="touch-target text-muted-foreground hover:text-foreground absolute top-0 right-0 inline-flex items-center justify-center"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password?.message && (
                <p id="signup-password-error" role="alert" className="text-destructive text-xs font-medium">
                  {t(errors.password.message, { defaultValue: errors.password.message })}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-confirm">{t('auth.confirmPassword')}</Label>
              <Input
                id="signup-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'signup-confirm-error' : undefined}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword?.message && (
                <p id="signup-confirm-error" role="alert" className="text-destructive text-xs font-medium">
                  {t(errors.confirmPassword.message, { defaultValue: errors.confirmPassword.message })}
                </p>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full rounded-full" loading={signup.isPending}>
              {signup.isPending ? t('auth.signingUp') : t('auth.signup')}
            </Button>
          </form>

          <p className="text-muted-foreground mt-5 text-center text-sm">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-primary font-semibold underline-offset-4 hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  )
}
