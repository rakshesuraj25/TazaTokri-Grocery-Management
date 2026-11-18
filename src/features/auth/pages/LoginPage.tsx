import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { useLogin } from '../hooks'
import { loginSchema, type LoginForm } from '../schemas'

export default function LoginPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const expired = params.get('expired') === '1'
  const next = params.get('next')
  const prefillPhone = params.get('phone') ?? ''
  const [showPassword, setShowPassword] = useState(false)

  const login = useLogin(next)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: prefillPhone, password: '' },
  })

  const onSubmit = (values: LoginForm) => {
    login.mutate(values, {
      onError: (err) => {
        const apiErr = toApiError(err)
        if (apiErr.fieldErrors) {
          for (const [field, msg] of Object.entries(apiErr.fieldErrors)) {
            if (field === 'phone' || field === 'password') {
              setError(field, { message: msg })
            }
          }
        }
      },
    })
  }

  const serverError = login.error ? toApiError(login.error) : null

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center px-4 py-8">
      <div className="grid w-full items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <AuthBrandPanel />

        <div className="mx-auto flex w-full max-w-md flex-col justify-center">
          {expired && (
            <div
              role="alert"
              className="bg-turmeric-light text-turmeric-foreground mb-4 flex items-center gap-2 rounded-xl border border-amber-300/60 p-3 text-sm font-medium"
            >
              <AlertCircle className="size-5 shrink-0" aria-hidden />
              <span>{t('auth.sessionExpired')}</span>
            </div>
          )}

          <Card className="p-1 sm:p-2">
            <CardHeader className="items-center text-center">
              <div className="bg-secondary mb-1 flex size-14 items-center justify-center rounded-full">
                <LogoMark size="md" decorative />
              </div>
              <CardTitle className="font-organic text-2xl">{t('auth.login')}</CardTitle>
              <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
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
                  <Label htmlFor="login-phone">{t('auth.phone')}</Label>
                  <Input
                    id="login-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    placeholder={t('auth.phonePlaceholder')}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'login-phone-error' : undefined}
                    {...register('phone')}
                  />
                  {errors.phone?.message && (
                    <p id="login-phone-error" role="alert" className="text-destructive text-xs font-medium">
                      {t(errors.phone.message, { defaultValue: errors.phone.message })}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder={t('auth.passwordPlaceholder')}
                      className="pr-11"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'login-password-error' : undefined}
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
                    <p id="login-password-error" role="alert" className="text-destructive text-xs font-medium">
                      {t(errors.password.message, { defaultValue: errors.password.message })}
                    </p>
                  )}
                </div>

                <Button type="submit" size="lg" className="w-full rounded-full" loading={login.isPending}>
                  {login.isPending ? t('auth.loggingIn') : t('auth.login')}
                </Button>
              </form>

              <p className="text-muted-foreground mt-5 text-center text-sm">
                {t('auth.noAccount')}{' '}
                <Link to="/signup" className="text-primary font-semibold underline-offset-4 hover:underline">
                  {t('auth.signup')}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
