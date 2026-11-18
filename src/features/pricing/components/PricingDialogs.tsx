import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { useVegetableName } from '@/hooks/useVegetableName'
import { dec, formatQty, isValidDecimal, toApiMoney } from '@/lib/money'
import { toApiError } from '@/lib/api'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { useApplyPriceSuggestion, usePriceSuggestion, useSetPrice } from '../hooks'

export { PriceHistorySheet } from './PriceHistorySheet'

const priceSchema = z.object({
  pricePerUnit: z
    .string()
    .trim()
    .refine((v) => isValidDecimal(v, 2) && dec(v).gt(0), 'staff.stock.positiveRequired'),
  note: z.string().trim().max(200).optional(),
})
type PriceForm = z.infer<typeof priceSchema>

interface SetPriceDialogProps {
  vegetable: StaffCatalogItem | null
  onClose: () => void
}

export function SetPriceDialog({ vegetable, onClose }: SetPriceDialogProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const setPrice = useSetPrice()
  const suggestion = usePriceSuggestion(vegetable?.id)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PriceForm>({
    resolver: zodResolver(priceSchema),
    values: {
      pricePerUnit:
        vegetable?.pricePerUnit !== null && vegetable?.pricePerUnit !== undefined
          ? String(vegetable.pricePerUnit)
          : '',
      note: '',
    },
  })

  const enteredPrice = watch('pricePerUnit')
  const landedCost = suggestion.data?.averageLandedCost
  const belowCost =
    landedCost !== undefined &&
    isValidDecimal(enteredPrice || '', 2) &&
    dec(enteredPrice).gt(0) &&
    dec(enteredPrice).lt(dec(landedCost))

  const close = () => {
    reset()
    setServerError(null)
    onClose()
  }

  const onSubmit = (values: PriceForm) => {
    if (!vegetable) return
    setServerError(null)
    setPrice.mutate(
      {
        vegId: vegetable.id,
        body: {
          pricePerUnit: toApiMoney(values.pricePerUnit),
          note: values.note?.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('common.save'))
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
                {t('staff.pricing.setPrice')} — {name(vegetable)} ({vegetable.baseUnit})
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {serverError && (
                <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                  {serverError}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="price-input">
                  {t('staff.pricing.currentPrice')} (₹ / {vegetable.baseUnit})
                </Label>
                <Input
                  id="price-input"
                  type="number"
                  step="0.5"
                  min="0.01"
                  aria-invalid={!!errors.pricePerUnit}
                  {...register('pricePerUnit')}
                />
                {errors.pricePerUnit?.message && (
                  <p role="alert" className="text-destructive text-xs font-medium">
                    {t(errors.pricePerUnit.message, { defaultValue: errors.pricePerUnit.message })}
                  </p>
                )}
              </div>

              {belowCost && (
                <div className="bg-turmeric-light text-turmeric-foreground flex items-center gap-2 rounded-lg p-3 text-xs font-medium">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  <span>
                    {t('staff.pricing.belowCostWarning')} (<MoneyDisplay value={landedCost} />)
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="price-note">{t('staff.pricing.note')}</Label>
                <Input id="price-note" {...register('note')} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={setPrice.isPending}>
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

interface PriceSuggestionDialogProps {
  vegetable: StaffCatalogItem | null
  onClose: () => void
}

export function PriceSuggestionDialog({ vegetable, onClose }: PriceSuggestionDialogProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const suggestion = usePriceSuggestion(vegetable?.id)
  const applySuggestion = useApplyPriceSuggestion()

  const handleApply = () => {
    if (!vegetable) return
    applySuggestion.mutate(vegetable.id, {
      onSuccess: () => {
        toast.success(t('common.save'))
        onClose()
      },
      onError: (err) => toast.error(toApiError(err).message),
    })
  }

  return (
    <Dialog open={Boolean(vegetable)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {vegetable && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="text-primary size-5" />
                {t('staff.pricing.suggestion')} — {name(vegetable)}
              </DialogTitle>
            </DialogHeader>

            {suggestion.isLoading ? (
              <div className="skeleton h-36" />
            ) : suggestion.isError || !suggestion.data ? (
              <p className="bg-turmeric-light text-turmeric-foreground rounded-lg p-3 text-sm font-medium">
                {toApiError(suggestion.error).status === 400
                  ? t('staff.pricing.noPurchases')
                  : toApiError(suggestion.error).message}
              </p>
            ) : (
              <div className="space-y-2 rounded-xl border p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('staff.pricing.landedCost')}</span>
                  <MoneyDisplay value={suggestion.data.averageLandedCost} className="font-bold" />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('staff.pricing.wastageAdj')}</span>
                  <span>
                    {formatQty(suggestion.data.wastagePercent, 1)}% →{' '}
                    <MoneyDisplay value={suggestion.data.costWithWastage} className="font-bold" />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('staff.pricing.margin')}</span>
                  <span>{formatQty(suggestion.data.marginPercent, 1)}%</span>
                </div>
                <div className="bg-secondary mt-2 flex items-center justify-between rounded-lg p-3">
                  <span className="font-semibold">{t('staff.pricing.suggestedPrice')}</span>
                  <MoneyDisplay
                    value={suggestion.data.suggestedPrice}
                    className="font-display text-primary text-xl font-extrabold"
                  />
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-xs">
                  <span className="text-muted-foreground">{t('staff.pricing.currentPrice')}</span>
                  {vegetable.pricePerUnit !== null ? (
                    <MoneyDisplay value={vegetable.pricePerUnit} className="font-bold" />
                  ) : (
                    <span className="text-turmeric-foreground font-semibold">
                      {t('staff.sale.noPriceBadge')}
                    </span>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('common.close')}
              </Button>
              {suggestion.data && (
                <Button onClick={handleApply} loading={applySuggestion.isPending}>
                  {t('staff.pricing.applyPrice')}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
