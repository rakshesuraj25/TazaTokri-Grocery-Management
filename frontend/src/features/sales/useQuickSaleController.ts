import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useStaffCatalog, useToggleAvailability } from '@/features/catalog/hooks'
import { matchesVegetableSearch } from '@/features/catalog/shopHelpers'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { toApiError } from '@/lib/api'
import { createClientRef } from '@/lib/idempotency'
import { addMoney, dec, isPositive, mulMoney, sumMoney, toApiQty } from '@/lib/money'
import { useCreateSale } from './hooks'
import type { BillLine } from './components/QuickSaleBill'
import type { SalePaymentMethod, SaleResponse } from './types'

export function useQuickSaleController() {
  const { t } = useTranslation()
  const catalog = useStaffCatalog()
  const toggleAvail = useToggleAvailability()
  const createSale = useCreateSale()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('ALL')
  const [lines, setLines] = useState<BillLine[]>([])
  const [lastBill, setLastBill] = useState<BillLine[] | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('CASH')
  // Idempotency key: generated ONCE per bill attempt, reused on retry, rotated ONLY on success
  const [clientRef, setClientRef] = useState<string>(() => createClientRef())
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [lastSalesDrawerOpen, setLastSalesDrawerOpen] = useState(false)
  const [keypadTarget, setKeypadTarget] = useState<BillLine | null>(null)
  const [completedSale, setCompletedSale] = useState<SaleResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const item of catalog.data ?? []) set.add(item.category)
    return ['ALL', ...Array.from(set)]
  }, [catalog.data])

  const filtered = useMemo(() => {
    return (catalog.data ?? []).filter((v) => {
      if (category !== 'ALL' && v.category !== category) return false
      return matchesVegetableSearch(v, search)
    })
  }, [catalog.data, category, search])

  const syncedLines = useMemo(() => {
    if (!catalog.data) return lines
    const byId = new Map(catalog.data.map((item) => [String(item.id), item]))
    return lines.map((l) => {
      const fresh = byId.get(String(l.item.id))
      return fresh ? { ...l, item: fresh } : l
    })
  }, [lines, catalog.data])

  const estimatedTotal = useMemo(
    () => sumMoney(syncedLines.map((l) => mulMoney(l.item.pricePerUnit ?? 0, l.quantity))),
    [syncedLines],
  )

  const handleAddQty = (item: StaffCatalogItem, baseQty: string) => {
    setSubmitError(null)
    setLines((prev) => {
      const existing = prev.find((l) => String(l.item.id) === String(item.id))
      if (existing) {
        const nextQty = toApiQty(addMoney(existing.quantity, baseQty))
        return prev.map((l) =>
          String(l.item.id) === String(item.id) ? { item, quantity: nextQty } : l,
        )
      }
      return [...prev, { item, quantity: toApiQty(baseQty) }]
    })
  }

  const handleChangeQty = (vegId: string | number, nextQty: string) => {
    setSubmitError(null)
    setLines((prev) =>
      prev.map((l) => (String(l.item.id) === String(vegId) ? { ...l, quantity: nextQty } : l)),
    )
  }

  const handleRemoveLine = (vegId: string | number) => {
    setLines((prev) => prev.filter((l) => String(l.item.id) !== String(vegId)))
  }

  const handleClear = () => {
    setSubmitError(null)
    setLines([])
    setClientRef(createClientRef())
  }

  const handleSubmit = () => {
    if (createSale.isPending || submittingRef.current) return
    const validLines = syncedLines.filter((l) => isPositive(l.quantity))
    if (validLines.length === 0) return
    if (validLines.some((l) => dec(l.quantity).gt(dec(l.item.stock)))) return
    submittingRef.current = true
    setSubmitError(null)

    createSale.mutate(
      {
        clientRef,
        paymentMethod,
        items: validLines.map((l) => ({
          vegetableId: l.item.id,
          quantity: toApiQty(l.quantity),
        })),
      },
      {
        onSuccess: (sale) => {
          submittingRef.current = false
          toast.success(t('staff.sale.saleSuccess'))
          setLastBill(validLines)
          setLines([])
          setClientRef(createClientRef())
          setMobileSheetOpen(false)
          setCompletedSale(sale)
        },
        onError: (err) => {
          submittingRef.current = false
          setSubmitError(toApiError(err).message)
        },
      },
    )
  }

  const handleToggleAvail = (id: string | number, value: boolean) => {
    toggleAvail.mutate(
      { id, value },
      {
        onSuccess: () => {
          toast.success(
            value
              ? t('staff.sale.markedAvailable', { defaultValue: 'Marked available today' })
              : t('staff.sale.markedUnavailable', { defaultValue: 'Marked unavailable today' }),
            {
              duration: 5000,
              action: {
                label: t('common.undo', { defaultValue: 'Undo' }),
                onClick: () => toggleAvail.mutate({ id, value: !value }),
              },
            },
          )
        },
      },
    )
  }

  const handleRepeatLastBill = () => {
    if (!lastBill?.length) return
    setSubmitError(null)
    setLines(lastBill)
    setClientRef(createClientRef())
  }

  const handleRepeatFromSale = (sale: SaleResponse) => {
    const byId = new Map((catalog.data ?? []).map((item) => [String(item.id), item]))
    const nextLines: BillLine[] = []
    for (const sItem of sale.items) {
      const catItem = byId.get(String(sItem.vegetableId))
      if (catItem && catItem.available && catItem.pricePerUnit !== null && dec(catItem.stock).gt(0)) {
        nextLines.push({ item: catItem, quantity: toApiQty(sItem.quantity) })
      }
    }
    if (nextLines.length === 0) {
      toast.info(t('common.noResults'))
      return
    }
    setSubmitError(null)
    setLines(nextLines)
    setClientRef(createClientRef())
    setLastSalesDrawerOpen(false)
    toast.success(t('staff.sale.billLoaded', { defaultValue: 'Loaded items into bill' }))
  }

  return {
    catalog,
    search,
    setSearch,
    category,
    setCategory,
    categories,
    filtered,
    syncedLines,
    lastBill,
    paymentMethod,
    setPaymentMethod,
    estimatedTotal,
    isSubmitting: createSale.isPending,
    submitError,
    mobileSheetOpen,
    setMobileSheetOpen,
    lastSalesDrawerOpen,
    setLastSalesDrawerOpen,
    keypadTarget,
    setKeypadTarget,
    completedSale,
    setCompletedSale,
    handleAddQty,
    handleChangeQty,
    handleRemoveLine,
    handleClear,
    handleSubmit,
    handleToggleAvail,
    handleRepeatLastBill,
    handleRepeatFromSale,
  }
}
