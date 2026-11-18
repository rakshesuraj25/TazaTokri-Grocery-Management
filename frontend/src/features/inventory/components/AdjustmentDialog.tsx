import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
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
import { dec, formatQty, toApiQty } from '@/lib/money'
import { toApiError } from '@/lib/api'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { useRecordAdjustment } from '../hooks'

const adjustmentSchema = z.object({
  quantity: z
    .string()
    .trim()
    .refine(
      (v) => /^[+-]?\d+(\.\d{1,3})?$/.test(v) && !dec(v).isZero(),
      'staff.stock.nonZeroRequired',
    ),
  note: z.string().trim().min(3, 'staff.stock.noteRequired').max(200),
})
type AdjustmentForm = z.infer<typeof adjustmentSchema>

interface AdjustmentDialogProps {
  vegetable: StaffCatalogItem | null
  onClose: () => void
}

/** OWNER-only append-only ledger adjustment dialog. */
export function AdjustmentDialog({ vegetable, onClose }: AdjustmentDialogProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const recordAdjustment = useRecordAdjustment()
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdjustmentForm>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { quantity: '', note: '' },
  })

  const close = () => {
    reset()
    setConfirmed(false)
    setServerError(null)
    onClose()
  }

  const onSubmit = (values: AdjustmentForm) => {
    if (!vegetable) return
    setServerError(null)
    recordAdjustment.mutate(
      {
        vegetableId: vegetable.id,
        quantity: toApiQty(values.quantity),
        note: values.note.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t('staff.stock.adjustSuccess'))
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
                {t('staff.stock.adjustStock')} — {name(vegetable)}
              </DialogTitle>
              <DialogDescription>
                {t('staff.stock.currentStock')}: {formatQty(vegetable.stock)}{' '}
                {t(`units.${vegetable.baseUnit}`, { defaultValue: vegetable.baseUnit })}
              </DialogDescription>
            </DialogHeader>

            <div className="bg-turmeric-light text-turmeric-foreground flex items-start gap-2 rounded-lg p-3 text-xs font-medium">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t('staff.stock.adjustWarning')}</span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {serverError && (
                <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                  {serverError}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="adj-qty">
                  {t('staff.stock.quantity')} ({vegetable.baseUnit})
                </Label>
                <Input
                  id="adj-qty"
                  type="text"
                  inputMode="decimal"
                  placeholder="-1.5 or +2"
                  aria-invalid={!!errors.quantity}
                  {...register('quantity')}
                />
                <p className="text-muted-foreground text-xs">
                  {t('staff.stock.positiveOrNegative')}
                </p>
                {errors.quantity?.message && (
                  <p role="alert" className="text-destructive text-xs font-medium">
                    {t(errors.quantity.message, { defaultValue: errors.quantity.message })}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adj-note">{t('staff.stock.reason')}</Label>
                <Input id="adj-note" aria-invalid={!!errors.note} {...register('note')} />
                {errors.note?.message && (
                  <p role="alert" className="text-destructive text-xs font-medium">
                    {t(errors.note.message, { defaultValue: errors.note.message })}
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2 rounded-lg border p-2.5 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 size-4 rounded"
                />
                <span>
                  {t('staff.stock.confirmAdjustment', {
                    defaultValue: 'Confirm this append-only ledger adjustment',
                  })}
                </span>
              </label>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={!confirmed} loading={recordAdjustment.isPending}>
                  {t('common.save')}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
