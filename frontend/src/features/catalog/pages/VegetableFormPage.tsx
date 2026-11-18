import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VegetableImage } from '@/components/VegetableImage'
import { dec, isValidDecimal, toApiQty } from '@/lib/money'
import { toApiError } from '@/lib/api'
import {
  useCategories,
  useCreateVegetable,
  useUpdateVegetable,
  useVegetable,
} from '../hooks'
import type { BaseUnit } from '../types'

const unitRowSchema = z.object({
  label: z.string().trim().min(1, 'Required').max(40),
  quantityInBaseUnit: z
    .string()
    .trim()
    .refine((v) => isValidDecimal(v, 3) && dec(v).gt(0), 'staff.stock.positiveRequired'),
  defaultOption: z.boolean(),
})

const createVegSchema = z
  .object({
    nameEn: z.string().trim().min(2, 'Required').max(80),
    nameMr: z.string().trim().max(80).optional(),
    nameHi: z.string().trim().max(80).optional(),
    imageUrl: z.string().trim().max(500).optional(),
    categoryId: z.coerce.number().int().positive('Required'),
    baseUnit: z.enum(['KG', 'PIECE', 'BUNCH']),
    units: z.array(unitRowSchema).min(1),
  })
  .refine((v) => v.units.filter((u) => u.defaultOption).length === 1, {
    path: ['units'],
    message: 'staff.catalog.oneDefaultError',
  })

type VegFormValues = z.infer<typeof createVegSchema>

export default function VegetableFormPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const categories = useCategories()
  const existing = useVegetable(id)
  const createVeg = useCreateVegetable()
  const updateVeg = useUpdateVegetable(id ?? '')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VegFormValues>({
    resolver: zodResolver(createVegSchema),
    defaultValues: {
      nameEn: '',
      nameMr: '',
      nameHi: '',
      imageUrl: '',
      categoryId: 0,
      baseUnit: 'KG',
      units: [
        { label: '250g', quantityInBaseUnit: '0.25', defaultOption: false },
        { label: '500g', quantityInBaseUnit: '0.5', defaultOption: true },
        { label: '1 kg', quantityInBaseUnit: '1', defaultOption: false },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'units' })
  const unitsWatch = watch('units')

  useEffect(() => {
    if (isEdit && existing.data) {
      const v = existing.data
      reset({
        nameEn: v.nameEn,
        nameMr: v.nameMr ?? '',
        nameHi: v.nameHi ?? '',
        imageUrl: v.imageUrl ?? '',
        categoryId: v.categoryId,
        baseUnit: v.baseUnit,
        units: v.units.map((u) => ({
          label: u.label,
          quantityInBaseUnit: String(u.quantityInBaseUnit),
          defaultOption: u.defaultOption,
        })),
      })
    }
  }, [isEdit, existing.data, reset])

  const selectDefaultUnit = (index: number) => {
    unitsWatch.forEach((_, idx) => {
      setValue(`units.${idx}.defaultOption`, idx === index)
    })
  }

  const onSubmit = (values: VegFormValues) => {
    setServerError(null)
    if (isEdit) {
      updateVeg.mutate(
        {
          nameEn: values.nameEn.trim(),
          nameMr: values.nameMr?.trim() || undefined,
          nameHi: values.nameHi?.trim() || undefined,
          imageUrl: values.imageUrl?.trim() || undefined,
          categoryId: Number(values.categoryId),
        },
        {
          onSuccess: () => {
            toast.success(t('staff.catalog.vegSaved'))
            navigate('/staff/catalog')
          },
          onError: (err) => setServerError(toApiError(err).message),
        },
      )
    } else {
      createVeg.mutate(
        {
          nameEn: values.nameEn.trim(),
          nameMr: values.nameMr?.trim() || undefined,
          nameHi: values.nameHi?.trim() || undefined,
          imageUrl: values.imageUrl?.trim() || undefined,
          categoryId: Number(values.categoryId),
          baseUnit: values.baseUnit as BaseUnit,
          units: values.units.map((u) => ({
            label: u.label.trim(),
            quantityInBaseUnit: toApiQty(u.quantityInBaseUnit),
            defaultOption: u.defaultOption,
          })),
        },
        {
          onSuccess: () => {
            toast.success(t('staff.catalog.vegSaved'))
            navigate('/staff/catalog')
          },
          onError: (err) => setServerError(toApiError(err).message),
        },
      )
    }
  }

  const isPending = createVeg.isPending || updateVeg.isPending

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/staff/catalog" aria-label={t('common.back')}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-extrabold">
          {isEdit ? t('staff.catalog.editVeg') : t('staff.catalog.addVeg')}
        </h1>
      </div>

      <Card className="p-5">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && (
            <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
              {serverError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="veg-en">{t('staff.catalog.nameEn')}</Label>
              <Input id="veg-en" aria-invalid={!!errors.nameEn} {...register('nameEn')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veg-mr">{t('staff.catalog.nameMr')}</Label>
              <Input id="veg-mr" {...register('nameMr')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veg-hi">{t('staff.catalog.nameHi')}</Label>
              <Input id="veg-hi" {...register('nameHi')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="veg-cat">{t('staff.catalog.category')}</Label>
              <select
                id="veg-cat"
                className="border-input bg-card flex h-11 w-full rounded-lg border px-3 text-base"
                {...register('categoryId')}
              >
                <option value={0}>--</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="veg-base">{t('staff.catalog.baseUnit')}</Label>
              <select
                id="veg-base"
                disabled={isEdit}
                className="border-input bg-card flex h-11 w-full rounded-lg border px-3 text-base disabled:opacity-60"
                {...register('baseUnit')}
              >
                <option value="KG">KG</option>
                <option value="PIECE">PIECE</option>
                <option value="BUNCH">BUNCH</option>
              </select>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <VegetableImage
              nameEn={watch('nameEn') || 'Vegetable'}
              imageUrl={watch('imageUrl')}
              size="md"
            />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="veg-img">{t('staff.catalog.imageUrl')}</Label>
              <Input id="veg-img" type="url" placeholder="https://..." {...register('imageUrl')} />
            </div>
          </div>

          {isEdit ? (
            <div className="bg-secondary/60 space-y-2 rounded-xl p-3">
              <p className="text-muted-foreground text-xs">{t('staff.catalog.unitsImmutable')}</p>
              <div className="flex flex-wrap gap-1.5">
                {existing.data?.units.map((u) => (
                  <Badge key={u.id} variant={u.defaultOption ? 'default' : 'outline'}>
                    {u.label} ({u.quantityInBaseUnit})
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <Label>{t('staff.catalog.sellingUnits')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({ label: '', quantityInBaseUnit: '1', defaultOption: false })
                  }
                >
                  <Plus className="size-4" />
                  {t('staff.catalog.addUnitRow')}
                </Button>
              </div>

              {fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-[1fr_110px_auto_auto] items-center gap-2">
                  <Input
                    placeholder={t('staff.catalog.unitLabel')}
                    aria-label={t('staff.catalog.unitLabel')}
                    {...register(`units.${idx}.label`)}
                  />
                  <Input
                    type="number"
                    step="0.05"
                    min="0.001"
                    placeholder="0.5"
                    aria-label={t('staff.catalog.qtyInBase')}
                    {...register(`units.${idx}.quantityInBaseUnit`)}
                  />
                  <button
                    type="button"
                    onClick={() => selectDefaultUnit(idx)}
                    className={`touch-target rounded-lg px-2.5 text-xs font-bold ${
                      unitsWatch[idx]?.defaultOption
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {t('staff.catalog.defaultOption')}
                  </button>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      aria-label={t('common.delete')}
                      className="touch-target text-muted-foreground hover:text-destructive inline-flex items-center justify-center"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}

              {errors.units?.root?.message && (
                <p role="alert" className="text-destructive text-xs font-medium">
                  {t(errors.units.root.message, { defaultValue: errors.units.root.message })}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button asChild variant="outline">
              <Link to="/staff/catalog">{t('common.cancel')}</Link>
            </Button>
            <Button type="submit" loading={isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
