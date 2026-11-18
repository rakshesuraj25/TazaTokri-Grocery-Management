import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { EstimatedAmount } from '@/components/MoneyDisplay'
import { useVegetables } from '@/features/catalog/hooks'
import { addMoney, dec, isValidDecimal, mulMoney, sumMoney, toApiMoney, toApiQty } from '@/lib/money'
import { todayIST } from '@/lib/dates'
import { toApiError } from '@/lib/api'
import { useCreatePurchase, useSuppliers } from '../hooks'
import {
  InvoiceScannerCard,
  type VerifiedPurchaseDraftPayload,
} from '../components/InvoiceScannerCard'

const itemSchema = z.object({
  vegetableId: z.coerce.number().int().positive('Required'),
  quantity: z
    .string()
    .trim()
    .refine((v) => isValidDecimal(v, 3) && dec(v).gt(0), 'staff.stock.positiveRequired'),
  ratePerUnit: z
    .string()
    .trim()
    .refine((v) => isValidDecimal(v, 2) && dec(v).gt(0), 'staff.stock.positiveRequired'),
})

const purchaseSchema = z
  .object({
    supplierId: z.coerce.number().int().positive('Required'),
    purchaseDate: z
      .string()
      .refine((d) => d <= todayIST(), 'staff.purchase.futureDateError'),
    transportCost: z
      .string()
      .trim()
      .refine((v) => isValidDecimal(v, 2) && dec(v).gte(0), 'Invalid'),
    note: z.string().trim().max(200).optional(),
    items: z.array(itemSchema).min(1),
  })
  .refine(
    (v) => {
      const ids = v.items.map((i) => Number(i.vegetableId))
      return new Set(ids).size === ids.length
    },
    { path: ['items'], message: 'staff.purchase.duplicateVegError' },
  )

type PurchaseFormValues = z.infer<typeof purchaseSchema>

export default function NewPurchasePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const suppliers = useSuppliers()
  const vegetables = useVegetables()
  const createPurchase = useCreatePurchase()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplierId: 0,
      purchaseDate: todayIST(),
      transportCost: '0',
      note: '',
      items: [{ vegetableId: 0, quantity: '', ratePerUnit: '' }],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })

  const handleApplyAiDraft = (payload: VerifiedPurchaseDraftPayload) => {
    if (payload.matchedSupplierId) {
      setValue('supplierId', payload.matchedSupplierId, { shouldDirty: true })
    }
    if (payload.purchaseDate && payload.purchaseDate <= todayIST()) {
      setValue('purchaseDate', payload.purchaseDate, { shouldDirty: true })
    }
    setValue('transportCost', payload.transportCost || '0', { shouldDirty: true })
    if (payload.note) {
      setValue('note', payload.note.slice(0, 200), { shouldDirty: true })
    }

    // Merge duplicate vegetable lines so uk_purchase_veg constraint is respected
    const mergedMap = new Map<number, { vegetableId: number; quantity: string; ratePerUnit: string }>()
    for (const item of payload.items) {
      const existing = mergedMap.get(item.vegetableId)
      if (existing) {
        const sumQty = dec(existing.quantity || 0).plus(dec(item.quantity || 0))
        existing.quantity = sumQty.toFixed(3).replace(/\.?0+$/, '')
      } else {
        mergedMap.set(item.vegetableId, { ...item })
      }
    }
    const mergedItems = Array.from(mergedMap.values())
    if (mergedItems.length > 0) {
      replace(mergedItems)
    }
  }
  const itemsWatch = watch('items')
  const transportWatch = watch('transportCost')

  // Display-only estimate of total purchase cost
  const itemsSubtotal = sumMoney(
    itemsWatch.map((i) => mulMoney(i.quantity || 0, i.ratePerUnit || 0)),
  )
  const transportNum = dec(transportWatch || 0)
  const estimatedTotal = addMoney(itemsSubtotal, transportNum)

  const onSubmit = (values: PurchaseFormValues) => {
    setServerError(null)
    createPurchase.mutate(
      {
        supplierId: values.supplierId,
        purchaseDate: values.purchaseDate,
        transportCost: toApiMoney(values.transportCost),
        note: values.note?.trim() || undefined,
        items: values.items.map((i) => ({
          vegetableId: i.vegetableId,
          quantity: toApiQty(i.quantity),
          ratePerUnit: toApiMoney(i.ratePerUnit),
        })),
      },
      {
        onSuccess: () => {
          toast.success(t('staff.purchase.purchaseSaved'))
          navigate('/staff/purchases')
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/staff/purchases" aria-label={t('common.back')}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-extrabold">{t('staff.purchase.newPurchase')}</h1>
      </div>

      <InvoiceScannerCard
        vegetables={vegetables.data ?? []}
        onApplyToForm={handleApplyAiDraft}
      />

      <Card className="p-5">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && (
            <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
              {serverError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pur-supplier">{t('staff.purchase.supplier')}</Label>
              <select
                id="pur-supplier"
                className="border-input bg-card flex h-11 w-full rounded-lg border px-3 text-sm"
                {...register('supplierId')}
              >
                <option value={0}>--</option>
                {(suppliers.data ?? []).map((s) => (
                  <option key={String(s.id)} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pur-date">{t('staff.purchase.purchaseDate')}</Label>
              <Input
                id="pur-date"
                type="date"
                max={todayIST()}
                aria-invalid={!!errors.purchaseDate}
                {...register('purchaseDate')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pur-transport">{t('staff.purchase.transportCost')}</Label>
              <Input
                id="pur-transport"
                type="number"
                step="0.01"
                min="0"
                {...register('transportCost')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pur-note">
              {t('staff.stock.note')} ({t('common.optional')})
            </Label>
            <Input id="pur-note" {...register('note')} />
          </div>

          <div className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <Label>{t('staff.purchase.items')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ vegetableId: 0, quantity: '', ratePerUnit: '' })}
              >
                <Plus className="size-4" />
                {t('staff.purchase.addItem')}
              </Button>
            </div>

            {fields.map((field, idx) => {
              const row = itemsWatch[idx]
              const selectedVeg = (vegetables.data ?? []).find(
                (v) => String(v.id) === String(row?.vegetableId),
              )
              const qtyOk = row?.quantity && dec(row.quantity).gt(0)
              const rateOk = row?.ratePerUnit && dec(row.ratePerUnit).gt(0)
              const lineSub = qtyOk && rateOk ? mulMoney(row.quantity, row.ratePerUnit) : dec(0)
              const shareTransport =
                itemsSubtotal.gt(0) && lineSub.gt(0)
                  ? transportNum.mul(lineSub).div(itemsSubtotal)
                  : dec(0)
              const landedCost =
                qtyOk && rateOk ? lineSub.plus(shareTransport).div(dec(row.quantity)) : null

              return (
                <div key={field.id} className="space-y-1.5 rounded-lg border p-2.5">
                  <div className="grid gap-2 sm:grid-cols-[1fr_130px_130px_auto] sm:items-center">
                    <select
                      aria-label={t('staff.purchase.vegetable')}
                      className="border-input bg-card flex h-11 w-full rounded-lg border px-3 text-sm"
                      {...register(`items.${idx}.vegetableId`)}
                    >
                      <option value={0}>-- {t('staff.purchase.vegetable')} --</option>
                      {(vegetables.data ?? []).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nameEn} ({v.baseUnit})
                        </option>
                      ))}
                    </select>

                    <Input
                      type="number"
                      step="0.1"
                      min="0.001"
                      placeholder={
                        selectedVeg
                          ? `${t('staff.purchase.quantity')} (${selectedVeg.baseUnit})`
                          : t('staff.purchase.quantity')
                      }
                      aria-label={t('staff.purchase.quantity')}
                      {...register(`items.${idx}.quantity`)}
                    />

                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={t('staff.purchase.ratePerUnit')}
                      aria-label={t('staff.purchase.ratePerUnit')}
                      {...register(`items.${idx}.ratePerUnit`)}
                    />

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
                  {(lineSub.gt(0) || landedCost) && (
                    <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
                      {lineSub.gt(0) && (
                        <span>
                          {t('cart.subtotal')}: <EstimatedAmount value={lineSub.toFixed(2)} />
                        </span>
                      )}
                      {landedCost && (
                        <span>
                          {t('staff.purchase.landedCostPreview', {
                            defaultValue: 'Display-only landed cost:',
                          })}{' '}
                          <EstimatedAmount value={landedCost.toFixed(2)} />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {errors.items?.root?.message && (
              <p role="alert" className="text-destructive text-xs font-medium">
                {t(errors.items.root.message, { defaultValue: errors.items.root.message })}
              </p>
            )}
          </div>

          <div className="bg-secondary/95 sticky bottom-3 z-10 flex items-center justify-between rounded-xl border px-4 py-3 shadow-md backdrop-blur">
            <span className="text-sm font-semibold">{t('staff.purchase.totalCost')}</span>
            <EstimatedAmount
              value={estimatedTotal.toFixed(2)}
              className="font-display text-primary text-lg font-extrabold"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link to="/staff/purchases">{t('common.cancel')}</Link>
            </Button>
            <Button type="submit" loading={createPurchase.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
