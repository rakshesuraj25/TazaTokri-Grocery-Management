import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { useAuthStore } from '@/features/auth/store'
import { toApiError } from '@/lib/api'
import { useCategories, useCreateCategory } from '../hooks'

const schema = z.object({
  name: z.string().trim().min(2, 'Required').max(60),
})
type FormValues = z.infer<typeof schema>

export default function CategoriesPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const isOwner = Boolean(user?.roles.includes('OWNER'))

  const categories = useCategories()
  const createCategory = useCreateCategory()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  })

  const onSubmit = (values: FormValues) => {
    setServerError(null)
    createCategory.mutate(
      { name: values.name.trim() },
      {
        onSuccess: () => {
          toast.success(t('staff.catalog.categorySaved'))
          reset()
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/staff/catalog" aria-label={t('common.back')}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-extrabold">{t('staff.catalog.categories')}</h1>
      </div>

      {isOwner && (
        <Card className="p-4">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="cat-name">{t('staff.catalog.categoryName')}</Label>
              <Input
                id="cat-name"
                aria-invalid={!!errors.name}
                placeholder="Leafy Greens"
                {...register('name')}
              />
            </div>
            <Button type="submit" loading={createCategory.isPending}>
              <Plus className="size-4" />
              {t('staff.catalog.addCategory')}
            </Button>
          </form>
          {serverError && (
            <p role="alert" className="text-destructive mt-2 text-xs font-medium">
              {serverError}
            </p>
          )}
        </Card>
      )}

      {categories.isPending || categories.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      ) : categories.isError ? (
        <ErrorState onRetry={() => void categories.refetch()} />
      ) : (categories.data ?? []).length === 0 ? (
        <EmptyState title={t('common.noData')} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {(categories.data ?? []).map((cat) => (
            <Card key={cat.id} asChild>
              <li className="flex items-center justify-between p-4">
                <span className="font-display font-bold">{cat.name}</span>
                <Badge variant={cat.active ? 'secondary' : 'outline'}>
                  {cat.active ? t('staff.catalog.activeToggle') : 'Inactive'}
                </Badge>
              </li>
            </Card>
          ))}
        </ul>
      )}
    </div>
  )
}
