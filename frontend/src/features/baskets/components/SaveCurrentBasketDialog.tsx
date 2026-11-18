import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookmarkPlus } from 'lucide-react'
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
import type { CartItem } from '@/features/cart/types'
import { toApiError } from '@/lib/api'
import { useCreateBasket, useUpsertBasketSchedule } from '../hooks'
import type { ScheduleFrequency } from '../types'

interface SaveCurrentBasketDialogProps {
  open: boolean
  items: CartItem[]
  onClose: () => void
}

const PRESET_NAMES = [
  'Weekly Vegetable Basket',
  'Monthly Grocery Basket',
  'Family Regular Items',
]

export function SaveCurrentBasketDialog({
  open,
  items,
  onClose,
}: SaveCurrentBasketDialogProps) {
  const { t } = useTranslation()
  const createBasket = useCreateBasket()
  const upsertSchedule = useUpsertBasketSchedule()

  const [name, setName] = useState('Weekly Vegetable Basket')
  const [frequency, setFrequency] = useState<ScheduleFrequency | 'NONE'>('WEEKLY')
  const [weekday, setWeekday] = useState<number>(1)
  const [serverError, setServerError] = useState<string | null>(null)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || items.length === 0) return
    setServerError(null)

    createBasket.mutate(
      {
        name: name.trim(),
        items: items.map((i) => ({
          vegetableId: Number(i.vegetableId),
          unitId: Number(i.unitId),
          count: i.count,
        })),
      },
      {
        onSuccess: (created) => {
          if (frequency !== 'NONE') {
            upsertSchedule.mutate(
              {
                id: created.id,
                body: {
                  frequency,
                  preferredDayOfWeek: frequency === 'CUSTOM_WEEKDAY' ? weekday : null,
                },
              },
              {
                onSuccess: () => {
                  toast.success(
                    t('baskets.savedWithSchedule', {
                      defaultValue: 'Saved basket and recurring reminder schedule!',
                    }),
                  )
                  onClose()
                },
                onError: () => {
                  toast.success(t('baskets.savedSuccess', { defaultValue: 'Basket saved!' }))
                  onClose()
                },
              },
            )
          } else {
            toast.success(t('baskets.savedSuccess', { defaultValue: 'Basket saved!' }))
            onClose()
          }
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="text-primary size-5" aria-hidden />
            {t('baskets.saveTitle', { defaultValue: 'Save Grocery Basket' })}
          </DialogTitle>
          <DialogDescription>
            {t('baskets.saveDesc', {
              defaultValue:
                'Save your basket to reorder in one tap. Recurring schedules only remind you and never auto-charge.',
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4" noValidate>
          {serverError && (
            <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
              {serverError}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="basket-name">
              {t('baskets.basketName', { defaultValue: 'Basket name' })}
            </Label>
            <Input
              id="basket-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekly Vegetable Basket"
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESET_NAMES.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={name === preset ? 'default' : 'outline'}
                  onClick={() => setName(preset)}
                  className="h-7 rounded-full text-xs"
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basket-frequency">
              {t('baskets.scheduleLabel', {
                defaultValue: 'Recurring reminder schedule (optional)',
              })}
            </Label>
            <select
              id="basket-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ScheduleFrequency | 'NONE')}
              className="border-input bg-card flex h-10 w-full rounded-lg border px-3 text-sm"
            >
              <option value="NONE">
                {t('baskets.noSchedule', { defaultValue: 'No recurring reminder (manual only)' })}
              </option>
              <option value="DAILY">{t('baskets.freqDaily', { defaultValue: 'Daily' })}</option>
              <option value="WEEKLY">{t('baskets.freqWeekly', { defaultValue: 'Weekly' })}</option>
              <option value="CUSTOM_WEEKDAY">
                {t('baskets.freqCustomWeekday', { defaultValue: 'Custom weekday' })}
              </option>
              <option value="BIWEEKLY">
                {t('baskets.freqBiweekly', { defaultValue: 'Every two weeks' })}
              </option>
            </select>

            {frequency === 'CUSTOM_WEEKDAY' && (
              <div className="space-y-1 pt-1">
                <Label htmlFor="basket-weekday" className="text-xs">
                  {t('baskets.preferredWeekday', { defaultValue: 'Preferred weekday' })}
                </Label>
                <select
                  id="basket-weekday"
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                  className="border-input bg-card flex h-9 w-full rounded-lg border px-3 text-xs"
                >
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                  <option value={7}>Sunday</option>
                </select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || items.length === 0}
              loading={createBasket.isPending || upsertSchedule.isPending}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
