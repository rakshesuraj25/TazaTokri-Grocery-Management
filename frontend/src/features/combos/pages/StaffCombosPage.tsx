import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Package, Plus, Sparkles, Trash2 } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { useStaffCatalog } from '@/features/catalog/hooks'
import { ProductsTabs } from '@/features/catalog/components/ProductsTabs'
import { toApiError } from '@/lib/api'
import { dec, formatMoney, mulMoney, sumMoney, toApiMoney, toApiQty } from '@/lib/money'
import {
  useCreateCombo,
  useSeedDefaultCombos,
  useStaffCombos,
  useToggleComboActive,
  useToggleComboAvailable,
  useUpdateCombo,
} from '../hooks'
import type { ComboDto, ComboItemInput } from '../types'

interface DraftComboRow {
  vegetableId: string
  unitLabel: string
  quantityInBaseUnit: string
}

export default function StaffCombosPage() {
  const { t } = useTranslation()
  const { name } = useVegetableName()

  const combos = useStaffCombos()
  const catalog = useStaffCatalog()
  const createCombo = useCreateCombo()
  const updateCombo = useUpdateCombo()
  const toggleAvail = useToggleComboAvailable()
  const toggleActive = useToggleComboActive()
  const seedDefaults = useSeedDefaultCombos()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCombo, setEditingCombo] = useState<ComboDto | null>(null)
  const [nameEn, setNameEn] = useState('')
  const [nameMr, setNameMr] = useState('')
  const [nameHi, setNameHi] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [rows, setRows] = useState<DraftComboRow[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const vegList = useMemo(() => catalog.data ?? [], [catalog.data])
  const vegById = useMemo(
    () => new Map(vegList.map((v) => [String(v.id), v])),
    [vegList],
  )

  const openCreate = () => {
    setEditingCombo(null)
    setNameEn('')
    setNameMr('')
    setNameHi('')
    setDescriptionEn('')
    setSellingPrice('')
    setImageUrl('')
    const firstTwo = vegList.slice(0, 2).map((v) => {
      const defOpt = v.options.find((o) => o.defaultOption) ?? v.options[0]
      return {
        vegetableId: String(v.id),
        unitLabel: defOpt?.label ?? '1kg',
        quantityInBaseUnit: String(defOpt?.quantityInBaseUnit ?? '1.000'),
      }
    })
    setRows(firstTwo)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (combo: ComboDto) => {
    setEditingCombo(combo)
    setNameEn(combo.nameEn)
    setNameMr(combo.nameMr ?? '')
    setNameHi(combo.nameHi ?? '')
    setDescriptionEn(combo.descriptionEn ?? '')
    setSellingPrice(String(combo.sellingPrice))
    setImageUrl(combo.imageUrl ?? '')
    setRows(
      combo.items.map((item) => ({
        vegetableId: String(item.vegetableId),
        unitLabel: item.unitLabel,
        quantityInBaseUnit: String(item.quantityInBaseUnit),
      })),
    )
    setFormError(null)
    setDialogOpen(true)
  }

  const previewRegularTotal = useMemo(() => {
    return sumMoney(
      rows.map((r) => {
        const v = vegById.get(r.vegetableId)
        if (!v || v.pricePerUnit === null || !r.quantityInBaseUnit) return 0
        return mulMoney(v.pricePerUnit, r.quantityInBaseUnit)
      }),
    )
  }, [rows, vegById])

  const handleAddRow = () => {
    const usedIds = new Set(rows.map((r) => r.vegetableId))
    const nextVeg = vegList.find((v) => !usedIds.has(String(v.id))) ?? vegList[0]
    if (!nextVeg) return
    const defOpt = nextVeg.options.find((o) => o.defaultOption) ?? nextVeg.options[0]
    setRows((prev) => [
      ...prev,
      {
        vegetableId: String(nextVeg.id),
        unitLabel: defOpt?.label ?? '1kg',
        quantityInBaseUnit: String(defOpt?.quantityInBaseUnit ?? '1.000'),
      },
    ])
  }

  const handleRemoveRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!nameEn.trim()) {
      setFormError(t('combos.nameRequired', { defaultValue: 'Combo name is required' }))
      return
    }
    if (rows.length < 2) {
      setFormError(
        t('combos.minTwoItems', {
          defaultValue: 'Select at least 2 vegetables for a combo pack',
        }),
      )
      return
    }
    const priceDec = dec(sellingPrice)
    if (priceDec.lte(0)) {
      setFormError(
        t('combos.invalidPrice', {
          defaultValue: 'Enter a combo selling price greater than ₹0',
        }),
      )
      return
    }

    const itemsPayload: ComboItemInput[] = rows.map((r) => ({
      vegetableId: Number(r.vegetableId),
      unitLabel: r.unitLabel.trim() || '1 unit',
      quantityInBaseUnit: toApiQty(r.quantityInBaseUnit),
    }))

    const payload = {
      nameEn: nameEn.trim(),
      nameMr: nameMr.trim() || undefined,
      nameHi: nameHi.trim() || undefined,
      descriptionEn: descriptionEn.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      sellingPrice: toApiMoney(sellingPrice),
      available: editingCombo ? editingCombo.available : true,
      items: itemsPayload,
    }

    if (editingCombo) {
      updateCombo.mutate(
        { id: editingCombo.id, body: payload },
        {
          onSuccess: () => {
            toast.success(t('combos.savedSuccess', { defaultValue: 'Combo pack saved' }))
            setDialogOpen(false)
          },
          onError: (err) => setFormError(toApiError(err).message),
        },
      )
    } else {
      createCombo.mutate(payload, {
        onSuccess: () => {
          toast.success(t('combos.savedSuccess', { defaultValue: 'Combo pack saved' }))
          setDialogOpen(false)
        },
        onError: (err) => setFormError(toApiError(err).message),
      })
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title={t('combos.staffTitle', { defaultValue: 'Combo Packs' })}
        count={combos.data?.length}
        breadcrumbs={[
          { label: t('staff.groups.products', { defaultValue: 'Products' }), to: '/staff/catalog' },
          { label: t('combos.staffTitle', { defaultValue: 'Combo Packs' }) },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={seedDefaults.isPending}
              onClick={() =>
                seedDefaults.mutate(undefined, {
                  onSuccess: () =>
                    toast.success(
                      t('combos.starterSeeded', {
                        defaultValue: 'Starter combo packs loaded',
                      }),
                    ),
                  onError: (err) => toast.error(toApiError(err).message),
                })
              }
              className="rounded-full"
            >
              <Sparkles className="size-4" aria-hidden />
              {t('combos.loadStarters', { defaultValue: 'Load starter combos' })}
            </Button>

            <Button type="button" size="sm" onClick={openCreate} className="rounded-full">
              <Plus className="size-4" aria-hidden />
              {t('combos.createCombo', { defaultValue: 'New combo pack' })}
            </Button>
          </div>
        }
      />

      <ProductsTabs />

      {combos.isPending || combos.isLoading ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : combos.isError ? (
        <ErrorState onRetry={() => void combos.refetch()} />
      ) : (combos.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Package className="size-8" aria-hidden />}
          title={t('combos.emptyStaff', { defaultValue: 'No combo packs created yet' })}
          description={t('combos.emptyStaffHint', {
            defaultValue:
              'Create a custom vegetable combo pack or load the 3 starter combos (Daily Cooking, Healthy Green, Family Kitchen).',
          })}
          actionLabel={t('combos.loadStarters', { defaultValue: 'Load starter combos' })}
          onAction={() => seedDefaults.mutate()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(combos.data ?? []).map((combo) => (
            <Card key={String(combo.id)} className="flex flex-col justify-between gap-3 p-4">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-bold">{name(combo)}</h2>
                      {combo.inStock ? (
                        <StatusBadge kind="stock" status="IN_STOCK" />
                      ) : (
                        <StatusBadge kind="stock" status="OUT_OF_STOCK" />
                      )}
                      {!combo.active && <Badge variant="outline">Disabled</Badge>}
                    </div>
                    {combo.descriptionEn && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {combo.descriptionEn}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <MoneyDisplay
                      value={combo.sellingPrice}
                      className="font-display text-primary text-xl font-extrabold"
                    />
                    {combo.regularCombinedPrice !== null && (
                      <p className="text-muted-foreground text-xs">
                        Regular: {formatMoney(combo.regularCombinedPrice)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-surface-subtle/60 flex flex-wrap gap-1.5 rounded-xl p-2.5">
                  {combo.items.map((item) => (
                    <span
                      key={String(item.vegetableId)}
                      className="bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                    >
                      <VegetableImage nameEn={item.nameEn} size="xs" />
                      <span>
                        {name(item)} ({item.unitLabel})
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-border/70 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {t('staff.catalog.availableToggle')}
                    </span>
                    <Switch
                      checked={combo.available}
                      onCheckedChange={(v) =>
                        toggleAvail.mutate({ id: combo.id, value: v })
                      }
                      aria-label={`${combo.nameEn} available`}
                    />
                  </label>

                  <label className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {t('staff.catalog.activeToggle')}
                    </span>
                    <Switch
                      checked={combo.active}
                      onCheckedChange={(v) =>
                        toggleActive.mutate({ id: combo.id, value: v })
                      }
                      aria-label={`${combo.nameEn} active`}
                    />
                  </label>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(combo)}
                  className="rounded-full"
                >
                  <Edit2 className="size-3.5" aria-hidden />
                  {t('common.edit')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCombo
                ? t('combos.editCombo', { defaultValue: 'Edit combo pack' })
                : t('combos.createCombo', { defaultValue: 'New combo pack' })}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4" noValidate>
            {formError && (
              <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
                {formError}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="combo-name-en">{t('staff.catalog.nameEn')}</Label>
                <Input
                  id="combo-name-en"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Daily Cooking Combo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="combo-name-mr">{t('staff.catalog.nameMr')}</Label>
                <Input
                  id="combo-name-mr"
                  value={nameMr}
                  onChange={(e) => setNameMr(e.target.value)}
                  placeholder="दैनंदिन स्वयंपाक कॉम्बो"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="combo-name-hi">{t('staff.catalog.nameHi')}</Label>
                <Input
                  id="combo-name-hi"
                  value={nameHi}
                  onChange={(e) => setNameHi(e.target.value)}
                  placeholder="दैनिक रसोई कॉम्बो"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="combo-desc-en">
                  {t('combos.description', { defaultValue: 'Description' })}
                </Label>
                <Input
                  id="combo-desc-en"
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  placeholder="Fresh everyday kitchen essentials"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="combo-price">
                  {t('combos.sellingPriceLabel', { defaultValue: 'Combo selling price (₹)' })}
                </Label>
                <Input
                  id="combo-price"
                  type="number"
                  step="1"
                  min="1"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="149.00"
                />
                {previewRegularTotal.gt(0) && (
                  <p className="text-muted-foreground text-xs">
                    Regular combined price: {formatMoney(previewRegularTotal)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('combos.includedVegetables', { defaultValue: 'Included vegetables' })}</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddRow}>
                  <Plus className="size-3.5" />
                  {t('staff.purchase.addItem')}
                </Button>
              </div>

              <div className="space-y-2">
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-2 rounded-xl border p-2.5 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
                  >
                    <select
                      aria-label={`Combo vegetable ${idx + 1}`}
                      value={row.vegetableId}
                      onChange={(e) => {
                        const nextId = e.target.value
                        const v = vegById.get(nextId)
                        const defOpt = v?.options.find((o) => o.defaultOption) ?? v?.options[0]
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  vegetableId: nextId,
                                  unitLabel: defOpt?.label ?? r.unitLabel,
                                  quantityInBaseUnit: String(
                                    defOpt?.quantityInBaseUnit ?? r.quantityInBaseUnit,
                                  ),
                                }
                              : r,
                          ),
                        )
                      }}
                      className="border-input bg-card h-10 rounded-lg border px-2.5 text-sm"
                    >
                      {vegList.map((v) => (
                        <option key={String(v.id)} value={String(v.id)}>
                          {v.nameEn} ({v.baseUnit})
                        </option>
                      ))}
                    </select>

                    <Input
                      value={row.unitLabel}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, unitLabel: e.target.value } : r,
                          ),
                        )
                      }
                      placeholder="1kg / 500g / 1 bunch"
                      aria-label={`Unit label ${idx + 1}`}
                    />

                    <Input
                      type="number"
                      step="0.05"
                      min="0.05"
                      value={row.quantityInBaseUnit}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, quantityInBaseUnit: e.target.value } : r,
                          ),
                        )
                      }
                      placeholder="1.000"
                      aria-label={`Quantity in base unit ${idx + 1}`}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={rows.length <= 2}
                      onClick={() => handleRemoveRow(idx)}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                loading={createCombo.isPending || updateCombo.isPending}
              >
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
