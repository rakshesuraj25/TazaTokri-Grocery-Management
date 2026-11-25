import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Phone, Search, ShieldCheck, Truck, UserCheck, UserPlus, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/Stat'
import { ALL_ROLES } from '@/features/auth/roles'
import { passwordSchema, phoneSchema } from '@/features/auth/schemas'
import { useAuthStore } from '@/features/auth/store'
import type { Role } from '@/features/auth/types'
import { useDeliveryPeople } from '@/features/delivery/hooks'
import { toApiError } from '@/lib/api'
import { useRegisterUser } from '../hooks'

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'auth.nameRequired').max(100),
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal('')),
  password: passwordSchema,
  roles: z.array(z.enum(['OWNER', 'STAFF', 'DELIVERY', 'CUSTOMER'])).min(1),
})
type RegisterForm = z.infer<typeof registerSchema>

export default function UsersPage() {
  const { t } = useTranslation()
  const currentUser = useAuthStore((s) => s.user)
  const registerUser = useRegisterUser()
  const deliveryPeople = useDeliveryPeople()
  const [serverError, setServerError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      password: '',
      roles: ['STAFF'],
    },
  })

  const selectedRoles = watch('roles')

  const filteredDelivery = useMemo(() => {
    const list = deliveryPeople.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q),
    )
  }, [deliveryPeople.data, search])

  const toggleRole = (role: Role) => {
    const next = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role]
    if (next.length > 0) setValue('roles', next)
  }

  const onSubmit = (values: RegisterForm) => {
    setServerError(null)
    registerUser.mutate(
      {
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        email: values.email?.trim() || undefined,
        password: values.password,
        roles: values.roles,
      },
      {
        onSuccess: () => {
          toast.success(t('common.save'))
          reset()
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3.5 py-4 sm:px-6 sm:py-6">
      <PageHeader
        title={t('nav.users')}
        serif
        subtitle={t('staff.users.subtitle', {
          defaultValue: 'Register shop staff or delivery riders and view active delivery team accounts.',
        })}
        breadcrumbs={[
          { label: t('staff.groups.team') },
          { label: t('nav.users') },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label={t('staff.users.signedInRole', { defaultValue: 'Active session' })}
          value={currentUser?.fullName || currentUser?.phone || '—'}
          hint={currentUser?.roles.map((r) => t(`roles.${r}`)).join(' · ')}
          tone="positive"
          icon={<UserCheck className="size-5" />}
        />
        <Stat
          label={t('roles.DELIVERY')}
          value={(deliveryPeople.data ?? []).length}
          tone="neutral"
          icon={<Truck className="size-5" />}
        />
        <Stat
          label={t('common.roles', { defaultValue: 'Roles' })}
          value={ALL_ROLES.length}
          tone="warning"
          icon={<ShieldCheck className="size-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Section 1: Register Team Member */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="text-primary size-5" aria-hidden />
              {t('staff.users.registerTitle', { defaultValue: 'Register Team Member' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {serverError && (
                <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                  {serverError}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">{t('auth.fullName')}</Label>
                  <Input id="reg-name" aria-invalid={!!errors.fullName} {...register('fullName')} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-phone">{t('auth.phone')}</Label>
                  <Input
                    id="reg-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder={t('auth.phonePlaceholder')}
                    aria-invalid={!!errors.phone}
                    {...register('phone')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email ({t('common.optional')})</Label>
                  <Input id="reg-email" type="email" {...register('email')} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-pass">{t('auth.password')}</Label>
                  <Input
                    id="reg-pass"
                    type="password"
                    aria-invalid={!!errors.password}
                    {...register('password')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('common.roles', { defaultValue: 'Roles' })}</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map((role) => {
                    const active = selectedRoles.includes(role)
                    return (
                      <label
                        key={role}
                        className={`touch-target inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleRole(role)}
                          className="size-3.5 rounded"
                        />
                        <span>{t(`roles.${role}`)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <Button type="submit" loading={registerUser.isPending} className="rounded-full">
                <UserPlus className="size-4" aria-hidden />
                {t('common.save')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Section 2: Existing Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="text-primary size-5" aria-hidden />
              {t('staff.users.existingTitle', { defaultValue: 'Existing Team Members' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser && (
              <div className="bg-surface-subtle/80 flex items-center justify-between gap-3 rounded-2xl border p-3.5">
                <div className="min-w-0">
                  <p className="font-display truncate font-bold">
                    {currentUser.fullName || currentUser.phone}
                  </p>
                  <p className="text-muted-foreground money-num text-xs">{currentUser.phone}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {currentUser.roles.map((r) => (
                    <Badge key={r} variant="default" className="rounded-full">
                      {t(`roles.${r}`)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(deliveryPeople.data ?? []).length > 0 && (
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  autoComplete="off"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('common.search')}
                  aria-label={t('common.search')}
                  className="bg-card pr-9 pl-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label={t('common.clear', { defaultValue: 'Clear' })}
                    className="touch-target text-muted-foreground hover:text-foreground absolute top-1/2 right-1 inline-flex -translate-y-1/2 items-center justify-center rounded-full"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}

            {filteredDelivery.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('common.noData')}</p>
            ) : (
              <ul className="divide-border divide-y rounded-2xl border">
                {filteredDelivery.map((p) => (
                  <li key={String(p.id)} className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold">{p.fullName}</p>
                        <Badge variant="success" className="rounded-full text-[11px]">
                          {t('common.active', { defaultValue: 'Active' })}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground money-num mt-0.5 text-xs">{p.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full">
                        {t('roles.DELIVERY')}
                      </Badge>
                      <Button asChild variant="outline" size="sm" className="rounded-full">
                        <a href={`tel:${p.phone}`}>
                          <Phone className="size-3.5" aria-hidden />
                          {t('common.call', { defaultValue: 'Call' })}
                        </a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-muted-foreground text-xs leading-relaxed">
              {t('staff.users.directoryNote', {
                defaultValue:
                  'Delivery accounts are listed live via /api/delivery/people. Listing other roles awaits backend user-directory support.',
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
