import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVegetableName } from '@/hooks/useVegetableName'
import { dec, formatQty, isValidDecimal, toApiQty } from '@/lib/money'
import { toApiError } from '@/lib/api'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { useRecordWastage } from '../hooks'

export { AdjustmentDialog } from './AdjustmentDialog'

export const WASTAGE_REASONS = [
  'Spoiled',
  'Damaged',
  'Expired',
  'Trimmed',
  'Returned',
  'Other',
] as const
export type WastageReason = (typeof WASTAGE_REASONS)[number]

const wastageSchema = z.object({
  quantity: z
    .string()
    .trim()
    .refine((v) => isValidDecimal(v, 3) && dec(v).gt(0), 'staff.stock.positiveRequired'),
  reason: z.string().trim().min(1),
  note: z.string().trim().max(200).optional(),
})
type WastageForm = z.infer<typeof wastageSchema>

interface WastageDialogProps {
  vegetable: StaffCatalogItem | null
  onClose: () => void
}

export function WastageDialog({ vegetable, onClose }: WastageDialogProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const recordWastage = useRecordWastage()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WastageForm>({
    resolver: zodResolver(wastageSchema),
    defaultValues: { quantity: '', reason: 'Spoiled', note: '' },
  })
  const selectedReason = watch('reason') || 'Spoiled'
  const reasonChips = [
    { key: 'Spoiled', label: t('staff.stock.reasonSpoiled', { defaultValue: 'Spoiled' }) },
    { key: 'Damaged', label: t('staff.stock.reasonDamaged', { defaultValue: 'Damaged' }) },
    { key: 'Expired', label: t('staff.stock.reasonExpired', { defaultValue: 'Expired' }) },
    { key: 'Trimmed', label: t('staff.stock.reasonTrimmed', { defaultValue: 'Trimmed' }) },
    { key: 'Returned', label: t('staff.stock.reasonReturned', { defaultValue: 'Returned' }) },
    { key: 'Other', label: t('staff.stock.reasonOther', { defaultValue: 'Other' }) },
  ]

  const close = () => {
    reset({ quantity: '', reason: 'Spoiled', note: '' })
    setServerError(null)
    onClose()
  }

  const onSubmit = (values: WastageForm) => {
    if (!vegetable || recordWastage.isPending) return
    const qtyDec = dec(values.quantity)
    const availStockDec = dec(vegetable.stock)
    if (qtyDec.gt(availStockDec)) {
      setServerError(
        t('staff.sale.exceedsStock', {
          stock: formatQty(vegetable.stock),
          unit: vegetable.baseUnit,
          defaultValue: `Cannot record wastage above current stock (${formatQty(vegetable.stock)} ${vegetable.baseUnit})`,
        }),
      )
      return
    }
    setServerError(null)
    const cleanReason = values.reason.trim() || 'Spoiled'
    const cleanNote = values.note?.trim()
    const formattedNote = cleanNote
      ? cleanNote.toLowerCase().startsWith(cleanReason.toLowerCase())
        ? cleanNote
        : `${cleanReason}: ${cleanNote}`
      : cleanReason

    recordWastage.mutate(
      {
        vegetableId: vegetable.id,
        quantity: toApiQty(values.quantity),
        reason: cleanReason,
        note: formattedNote,
      },
      {
        onSuccess: () => {
          toast.success(t('staff.stock.wastageSuccess'))
          close()
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <Dialog open={Boolean(vegetable)} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        {vegetable && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('staff.stock.recordWastage')} — {name(vegetable)}
              </DialogTitle>
              <DialogDescription>
                {t('staff.stock.currentStock')}: {formatQty(vegetable.stock)}{' '}
                {t(`units.${vegetable.baseUnit}`, { defaultValue: vegetable.baseUnit })}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {serverError && (
                <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                  {serverError}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="wastage-qty">
                  {t('staff.stock.quantity')} ({vegetable.baseUnit})
                </Label>
                <Input
                  id="wastage-qty"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0.001"
                  max={String(vegetable.stock)}
                  aria-invalid={!!errors.quantity}
                  {...register('quantity')}
                />
                {errors.quantity?.message && (
                  <p role="alert" className="text-destructive text-xs font-medium">
                    {t(errors.quantity.message, { defaultValue: errors.quantity.message })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">
                  {t('staff.stock.reason', { defaultValue: 'Reason' })}
                </span>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('staff.stock.reason', { defaultValue: 'Reason' })}>
                  {reasonChips.map((chip) => {
                    const active = selectedReason === chip.key
                    return (
                      <Button
                        key={chip.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => {
                          setValue('reason', chip.key, { shouldDirty: true, shouldTouch: true })
                          setValue('note', chip.key, { shouldDirty: true, shouldTouch: true })
                        }}
                      >
                        {chip.label}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wastage-note">
                  {t('staff.stock.note')} ({t('common.optional')})
                </Label>
                <Input id="wastage-note" {...register('note')} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="destructive" loading={recordWastage.isPending}>
                  {t('staff.stock.recordWastage')}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
