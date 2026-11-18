import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  Edit2,
  Pause,
  Play,
  ShoppingBasket,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/EmptyState'
import { EstimatedAmount } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { useCartStore } from '@/features/cart/store'
import { fmtDate } from '@/lib/dates'
import { toApiError } from '@/lib/api'
import {
  useCancelBasketSchedule,
  useDeleteBasket,
  usePauseBasketSchedule,
  useResumeBasketSchedule,
  useSavedBaskets,
  useUpdateBasket,
  useUpsertBasketSchedule,
} from '../hooks'
import type { SavedBasketDto, ScheduleFrequency } from '../types'

interface SavedBasketsSectionProps {
  compact?: boolean
  onBasketLoaded?: () => void
}

export function SavedBasketsSection({
  compact = false,
  onBasketLoaded,
}: SavedBasketsSectionProps) {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const basketsQuery = useSavedBaskets()
  const addItem = useCartStore((s) => s.addItem)
  const deleteBasket = useDeleteBasket()
  const updateBasket = useUpdateBasket()
  const upsertSchedule = useUpsertBasketSchedule()
  const pauseSchedule = usePauseBasketSchedule()
  const resumeSchedule = useResumeBasketSchedule()
  const cancelSchedule = useCancelBasketSchedule()

  const [scheduleTarget, setScheduleTarget] = useState<SavedBasketDto | null>(null)
  const [frequency, setFrequency] = useState<ScheduleFrequency>('WEEKLY')
  const [weekday, setWeekday] = useState<number>(1)

  const [editTarget, setEditTarget] = useState<SavedBasketDto | null>(null)
  const [editName, setEditName] = useState('')
  const [editCounts, setEditCounts] = useState<Record<string, number>>({})

  const list = basketsQuery.data ?? []
  const dueReminders = list.filter(
    (b) => b.schedule?.status === 'ACTIVE' && b.schedule.reminderDue,
  )

  const handleLoadIntoCart = (basket: SavedBasketDto) => {
    const availableLines = basket.items.filter(
      (i) => i.availableToday && i.currentUnitPrice !== null,
    )
    if (availableLines.length === 0) {
      toast.error(
        t('baskets.noneAvailableError', {
          defaultValue: 'None of the items in this basket are available in stock today.',
        }),
      )
      return
    }

    for (const item of availableLines) {
      addItem({
        vegetableId: String(item.vegetableId),
        unitId: String(item.unitId),
        count: item.count,
        nameEn: item.nameEn,
        nameMr: item.nameMr ?? undefined,
        nameHi: item.nameHi ?? undefined,
        unitLabel: item.unitLabel,
        pricePerUnit: String(item.currentUnitPrice),
        quantityInBaseUnit: String(item.quantityInBaseUnit),
        availableStock: String(item.availableStock),
      })
    }

    if (basket.unavailableItems.length > 0) {
      toast.info(
        t('orders.orderAgainPartial', {
          items: basket.unavailableItems.join(', '),
          defaultValue: `Added ${availableLines.length} item(s). Skipped unavailable: ${basket.unavailableItems.join(', ')}`,
        }),
      )
    } else {
      toast.success(
        t('baskets.loadedIntoCart', {
          name: basket.name,
          defaultValue: `Loaded "${basket.name}" into your cart`,
        }),
      )
    }
    onBasketLoaded?.()
  }

  const openScheduleModal = (basket: SavedBasketDto) => {
    setScheduleTarget(basket)
    setFrequency(basket.schedule?.frequency ?? 'WEEKLY')
    setWeekday(basket.schedule?.preferredDayOfWeek ?? 1)
  }

  const openEditModal = (basket: SavedBasketDto) => {
    setEditTarget(basket)
    setEditName(basket.name)
    const map: Record<string, number> = {}
    for (const item of basket.items) {
      map[`${item.vegetableId}:${item.unitId}`] = item.count
    }
    setEditCounts(map)
  }

  const handleSaveEdit = () => {
    if (!editTarget || !editName.trim()) return
    const nextItems = editTarget.items
      .map((item) => ({
        vegetableId: Number(item.vegetableId),
        unitId: Number(item.unitId),
        count: editCounts[`${item.vegetableId}:${item.unitId}`] ?? item.count,
      }))
      .filter((i) => i.count > 0)

    if (nextItems.length === 0) {
      toast.error(
        t('baskets.minOneItem', { defaultValue: 'Keep at least 1 item in the basket' }),
      )
      return
    }

    updateBasket.mutate(
      {
        id: editTarget.id,
        body: { name: editName.trim(), items: nextItems },
      },
      {
        onSuccess: () => {
          toast.success(t('baskets.updatedSuccess', { defaultValue: 'Basket updated' }))
          setEditTarget(null)
        },
        onError: (err) => toast.error(toApiError(err).message),
      },
    )
  }

  const handleSaveSchedule = () => {
    if (!scheduleTarget) return
    upsertSchedule.mutate(
      {
        id: scheduleTarget.id,
        body: {
          frequency,
          preferredDayOfWeek: frequency === 'CUSTOM_WEEKDAY' ? weekday : null,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            t('baskets.scheduleSaved', {
              defaultValue: 'Recurring reminder schedule updated',
            }),
          )
          setScheduleTarget(null)
        },
        onError: (err) => toast.error(toApiError(err).message),
      },
    )
  }

  if (compact && list.length === 0) return null

  return (
    <section className="space-y-3" data-testid="saved-baskets-section">
      {/* Recurring Basket Reminder Banner (Never auto-charges; prompts customer to review & confirm checkout) */}
      {dueReminders.length > 0 && (
        <div
          role="region"
          aria-label={t('baskets.reminderBannerTitle', {
            defaultValue: 'Scheduled basket reminder',
          })}
          data-testid="recurring-basket-reminder-banner"
          className="bg-secondary border-primary/35 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
        >
          <div className="flex items-start gap-2.5">
            <BellRing className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="space-y-0.5">
              <p className="font-display text-sm font-bold">
                {t('baskets.reminderReadyTitle', {
                  name: dueReminders[0].name,
                  defaultValue: `Recurring basket ready: "${dueReminders[0].name}"`,
                })}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('baskets.reminderSafetyNote', {
                  defaultValue:
                    'Load into your cart to review today’s prices and confirm checkout. Never auto-charged.',
                })}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => handleLoadIntoCart(dueReminders[0])}
            className="rounded-full"
          >
            <ShoppingBasket className="size-4" aria-hidden />
            {t('baskets.loadAndReview', { defaultValue: 'Load into cart' })}
          </Button>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={<ShoppingBasket className="size-8" aria-hidden />}
          title={t('baskets.emptyTitle', { defaultValue: 'No saved baskets yet' })}
          description={t('baskets.emptyHint', {
            defaultValue:
              'Add vegetables to your cart on the Shop page and click "Save as recurring basket" for 1-tap reordering.',
          })}
        />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {list.map((basket) => (
            <Card
              key={String(basket.id)}
              data-testid={`saved-basket-card-${basket.id}`}
              className="flex flex-col justify-between gap-3 p-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-display text-base font-bold">{basket.name}</h3>
                      {basket.schedule && (
                        <Badge
                          variant={
                            basket.schedule.status === 'ACTIVE' ? 'default' : 'secondary'
                          }
                          className="rounded-full text-[11px]"
                        >
                          {basket.schedule.frequency} · {basket.schedule.status}
                        </Badge>
                      )}
                    </div>
                    {basket.schedule?.nextReminderDate && (
                      <p className="text-muted-foreground text-[11px]">
                        {t('baskets.nextReminder', {
                          date: fmtDate(basket.schedule.nextReminderDate),
                          defaultValue: `Next reminder: ${fmtDate(basket.schedule.nextReminderDate)}`,
                        })}
                      </p>
                    )}
                  </div>

                  <EstimatedAmount
                    value={String(basket.estimatedTotal)}
                    className="font-display text-primary text-lg font-extrabold"
                  />
                </div>

                <div className="bg-surface-subtle/60 flex flex-wrap gap-1.5 rounded-xl p-2">
                  {basket.items.map((item) => (
                    <span
                      key={`${item.vegetableId}-${item.unitId}`}
                      className={`bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
                        !item.availableToday ? 'opacity-50 line-through' : ''
                      }`}
                    >
                      <VegetableImage nameEn={item.nameEn} size="xs" />
                      <span>
                        {name(item)} ({item.unitLabel}) × {item.count}
                      </span>
                    </span>
                  ))}
                </div>

                {basket.unavailableItems.length > 0 && (
                  <p className="text-warning flex items-center gap-1 text-xs font-medium">
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                    {t('baskets.unavailableWarning', {
                      items: basket.unavailableItems.join(', '),
                      defaultValue: `Unavailable today: ${basket.unavailableItems.join(', ')}`,
                    })}
                  </p>
                )}
              </div>

              <div className="border-border/70 flex flex-wrap items-center justify-between gap-1.5 border-t pt-2.5">
                <Button
                  size="sm"
                  onClick={() => handleLoadIntoCart(basket)}
                  className="rounded-full"
                >
                  <ShoppingBasket className="size-3.5" aria-hidden />
                  {t('baskets.addToCartBtn', { defaultValue: 'Add basket to cart' })}
                </Button>

                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openScheduleModal(basket)}
                    className="rounded-full"
                  >
                    <CalendarClock className="size-3.5" aria-hidden />
                    {t('baskets.scheduleBtn', { defaultValue: 'Schedule' })}
                  </Button>

                  {basket.schedule?.status === 'ACTIVE' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => pauseSchedule.mutate(basket.id)}
                      aria-label={t('baskets.pauseSchedule', {
                        defaultValue: 'Pause schedule',
                      })}
                    >
                      <Pause className="size-3.5" />
                    </Button>
                  )}

                  {basket.schedule?.status === 'PAUSED' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => resumeSchedule.mutate(basket.id)}
                      aria-label={t('baskets.resumeSchedule', {
                        defaultValue: 'Resume schedule',
                      })}
                    >
                      <Play className="size-3.5" />
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditModal(basket)}
                    aria-label={t('common.edit')}
                  >
                    <Edit2 className="size-3.5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      deleteBasket.mutate(basket.id, {
                        onSuccess: () =>
                          toast.success(
                            t('baskets.deletedSuccess', {
                              defaultValue: 'Saved basket deleted',
                            }),
                          ),
                      })
                    }
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Schedule Configuration Dialog */}
      <Dialog
        open={Boolean(scheduleTarget)}
        onOpenChange={(v) => !v && setScheduleTarget(null)}
      >
        <DialogContent>
          {scheduleTarget && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t('baskets.scheduleModalTitle', {
                    defaultValue: 'Recurring Basket Reminder',
                  })}{' '}
                  — {scheduleTarget.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sched-freq">
                    {t('baskets.frequencyLabel', { defaultValue: 'Frequency' })}
                  </Label>
                  <select
                    id="sched-freq"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                    className="border-input bg-card flex h-10 w-full rounded-lg border px-3 text-sm"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="CUSTOM_WEEKDAY">Custom weekday</option>
                    <option value="BIWEEKLY">Every two weeks</option>
                  </select>
                </div>

                {frequency === 'CUSTOM_WEEKDAY' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sched-dow">
                      {t('baskets.preferredWeekday', { defaultValue: 'Preferred weekday' })}
                    </Label>
                    <select
                      id="sched-dow"
                      value={weekday}
                      onChange={(e) => setWeekday(Number(e.target.value))}
                      className="border-input bg-card flex h-10 w-full rounded-lg border px-3 text-sm"
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

              <DialogFooter className="gap-2">
                {scheduleTarget.schedule && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive mr-auto"
                    onClick={() =>
                      cancelSchedule.mutate(scheduleTarget.id, {
                        onSuccess: () => setScheduleTarget(null),
                      })
                    }
                  >
                    {t('baskets.cancelSchedule', { defaultValue: 'Cancel schedule' })}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setScheduleTarget(null)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSaveSchedule} loading={upsertSchedule.isPending}>
                  {t('common.save')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Saved Basket Dialog */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent>
          {editTarget && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t('common.edit')} — {editTarget.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-basket-name">
                    {t('baskets.basketName', { defaultValue: 'Basket name' })}
                  </Label>
                  <Input
                    id="edit-basket-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <ul className="divide-border divide-y rounded-xl border text-sm">
                  {editTarget.items.map((item) => {
                    const key = `${item.vegetableId}:${item.unitId}`
                    const currentCount = editCounts[key] ?? item.count
                    return (
                      <li key={key} className="flex items-center justify-between gap-2 p-2.5">
                        <span>
                          {name(item)} ({item.unitLabel})
                        </span>
                        <Input
                          type="number"
                          min="0"
                          max="20"
                          value={currentCount}
                          onChange={(e) =>
                            setEditCounts((prev) => ({
                              ...prev,
                              [key]: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
                            }))
                          }
                          aria-label={`${item.nameEn} quantity`}
                          className="h-9 w-20 text-center"
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditTarget(null)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSaveEdit} loading={updateBasket.isPending}>
                  {t('common.save')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
