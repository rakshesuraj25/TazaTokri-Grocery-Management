import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, ShoppingBag, Sprout } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { EstimatedAmount } from '@/components/MoneyDisplay'
import { SectionHeader } from '@/components/SectionHeader'
import { ProductGridSkeleton } from '@/components/Skeletons'
import { useCartStore } from '@/features/cart/store'
import { pruneCartWithCatalog } from '@/features/cart/pruneCart'
import { CartContents } from '@/features/cart/components/CartContents'
import { CartDrawer } from '@/features/cart/components/CartDrawer'
import { useAuthStore } from '@/features/auth/store'
import { usePublicCombos } from '@/features/combos/hooks'
import { ShopCombosSection } from '@/features/combos/components/ShopCombosSection'
import { SaveCurrentBasketDialog } from '@/features/baskets/components/SaveCurrentBasketDialog'
import { SavedBasketsSection } from '@/features/baskets/components/SavedBasketsSection'
import { useCustomerOrders } from '@/features/orders/hooks'
import { buildUsualVegetables } from '@/features/orders/orderAgain'
import { useVegetableName } from '@/hooks/useVegetableName'
import { estimateDeliveryFee } from '@/lib/businessRules'
import { addMoney, mulMoney, sumMoney } from '@/lib/money'
import { usePublicVegetables } from '../hooks'
import { useFavouritesStore } from '../favouritesStore'
import {
  filterVegetablesBySearch,
  sortPublicOptions,
  sortPublicVegetables,
  type ShopSortOption,
} from '../shopHelpers'
import { VegetableCard } from '../components/VegetableCard'
import { ShopHero } from '../components/ShopHero'
import { ShopFeaturedCategories } from '../components/ShopFeaturedCategories'
import { ShopToolbar } from '../components/ShopToolbar'
import { ShopTrustFooter } from '../components/ShopTrustFooter'

export default function ShopPage() {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const catalog = usePublicVegetables()
  const publicCombos = usePublicCombos()
  const pastOrders = useCustomerOrders(0, Boolean(user))
  const items = useCartStore((s) => s.items)
  const combos = useCartStore((s) => s.combos)
  const addItem = useCartStore((s) => s.addItem)
  const replaceItems = useCartStore((s) => s.replaceItems)
  const favouriteIds = useFavouritesStore((s) => s.ids)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<ShopSortOption>('name')
  const [category, setCategory] = useState<string>('ALL')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [saveBasketOpen, setSaveBasketOpen] = useState(false)
  const [prunedNames, setPrunedNames] = useState<string[]>([])

  // Prune cart lines missing/out-of-stock/unpriced once live catalog loads, preserving clientRef
  useEffect(() => {
    if (!catalog.data || items.length === 0) return
    const { validItems, removedItems } = pruneCartWithCatalog(items, catalog.data)
    if (removedItems.length > 0) {
      replaceItems(validItems)
      setPrunedNames(removedItems.map((r) => r.nameEn))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.data])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const v of catalog.data ?? []) set.add(v.category)
    return ['ALL', ...Array.from(set)]
  }, [catalog.data])

  const usualVegetables = useMemo(
    () => buildUsualVegetables(pastOrders.data ?? [], catalog.data ?? [], 4),
    [pastOrders.data, catalog.data],
  )

  const filtered = useMemo(() => {
    const byCategoryAndStock = (catalog.data ?? []).filter((v) => {
      if (inStockOnly && !v.inStock) return false
      if (category === 'FAVOURITES' && !favouriteIds.includes(String(v.id))) return false
      if (category !== 'ALL' && category !== 'FAVOURITES' && v.category !== category) return false
      return true
    })
    const matches = filterVegetablesBySearch(byCategoryAndStock, search)
    return sortPublicVegetables(matches, sortBy, (veg) => name(veg))
  }, [catalog.data, category, favouriteIds, inStockOnly, name, search, sortBy])

  const itemsSubtotal = useMemo(
    () => sumMoney(items.map((i) => mulMoney(i.pricePerUnit, i.count))),
    [items],
  )
  const combosSubtotal = useMemo(
    () => sumMoney(combos.map((c) => mulMoney(c.sellingPrice, c.count))),
    [combos],
  )
  const subtotal = useMemo(
    () => addMoney(itemsSubtotal, combosSubtotal),
    [itemsSubtotal, combosSubtotal],
  )
  const estimatedTotal = useMemo(
    () => addMoney(subtotal, estimateDeliveryFee(subtotal)),
    [subtotal],
  )
  const totalCartLines =
    items.reduce((acc, i) => acc + i.count, 0) +
    combos.reduce((acc, c) => acc + c.count, 0)
  const hasCatalogData = (catalog.data ?? []).length > 0

  const handleCheckout = () => {
    setCartOpen(false)
    navigate(user ? '/shop/checkout' : '/login?next=%2Fshop%2Fcheckout')
  }

  const handleOpenSaveBasket = () => {
    setCartOpen(false)
    if (!user) {
      navigate('/login?next=%2Fshop')
      return
    }
    setSaveBasketOpen(true)
  }

  const handleAddAllUsuals = () => {
    let added = 0
    for (const veg of usualVegetables) {
      if (!veg.inStock) continue
      const sorted = sortPublicOptions(veg.options)
      const defOpt = sorted.find((o) => o.defaultOption) ?? sorted[0]
      if (!defOpt || defOpt.price === null || defOpt.price === undefined) continue
      addItem({
        vegetableId: String(veg.id),
        unitId: String(defOpt.unitId),
        count: 1,
        nameEn: veg.nameEn,
        nameMr: veg.nameMr ?? undefined,
        nameHi: veg.nameHi ?? undefined,
        unitLabel: defOpt.label,
        pricePerUnit: String(defOpt.price),
        quantityInBaseUnit: String(defOpt.quantityInBaseUnit),
        availableStock:
          veg.availableStock !== undefined && veg.availableStock !== null
            ? String(veg.availableStock)
            : undefined,
      })
      added += 1
    }
    if (added > 0) {
      toast.success(
        t('orders.orderAgainAdded', { defaultValue: 'Added items to your cart' }),
      )
    }
  }

  return (
    <div className="space-y-4 p-4 pb-28 lg:pb-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-5">
          <ShopHero featuredVegetables={catalog.data ?? []} />

          {Boolean(user) && category === 'ALL' && !search.trim() && (
            <SavedBasketsSection compact />
          )}

          {category === 'ALL' && !search.trim() && (publicCombos.data ?? []).length > 0 && (
            <ShopCombosSection
              combos={publicCombos.data ?? []}
              usualVegetables={usualVegetables}
            />
          )}

          <ShopFeaturedCategories
            categories={categories}
            vegetables={catalog.data ?? []}
            selectedCategory={category}
            onSelectCategory={setCategory}
          />

          <ShopToolbar
            search={search}
            onSearchChange={setSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
            category={category}
            onCategoryChange={setCategory}
            inStockOnly={inStockOnly}
            onInStockOnlyChange={setInStockOnly}
            categories={categories}
            favouritesCount={favouriteIds.length}
          />

          {usualVegetables.length > 0 && category === 'ALL' && !search.trim() && (
            <section className="space-y-3" data-testid="shop-your-usual-section">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionHeader
                  title={t('shop.yourUsual', { defaultValue: 'Your usual' })}
                  count={usualVegetables.length}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAllUsuals}
                  className="rounded-full"
                >
                  <Plus className="size-3.5" aria-hidden />
                  {t('shop.addAllUsuals', { defaultValue: 'Add all usuals' })}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-4">
                {usualVegetables.map((veg) => (
                  <VegetableCard key={`usual-${veg.id}`} vegetable={veg} />
                ))}
              </div>
            </section>
          )}

          {catalog.isPending || catalog.isLoading ? (
            <ProductGridSkeleton count={6} />
          ) : catalog.isError ? (
            <ErrorState onRetry={() => void catalog.refetch()} />
          ) : !hasCatalogData ? (
            <EmptyState
              icon={<Sprout className="size-8" aria-hidden />}
              title={t('shop.emptyCatalog')}
              actionLabel={t('common.retry')}
              onAction={() => void catalog.refetch()}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="size-8" aria-hidden />}
              title={t('common.noResults')}
              description={t('shop.noSearchMatchHint')}
              actionLabel={t('shop.clearFilters')}
              onAction={() => {
                setSearch('')
                setCategory('ALL')
                setInStockOnly(false)
              }}
            />
          ) : (
            <div
              id="shop-catalog"
              className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
            >
              {filtered.map((veg) => (
                <VegetableCard key={veg.id} vegetable={veg} />
              ))}
            </div>
          )}

          <ShopTrustFooter />
        </div>

        {/* Desktop persistent cart side panel */}
        <aside className="hidden lg:sticky lg:top-20 lg:block">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-organic text-lg font-bold">{t('cart.title')}</h2>
              {totalCartLines > 0 && (
                <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-bold">
                  {totalCartLines}
                </span>
              )}
            </div>
            <CartContents
              onCheckout={handleCheckout}
              onSaveAsBasket={handleOpenSaveBasket}
              prunedNames={prunedNames}
              onDismissPruned={() => setPrunedNames([])}
              compactListClassName="max-h-80"
            />
          </Card>
        </aside>
      </div>

      {/* Mobile sticky cart summary bar */}
      {(totalCartLines > 0 || prunedNames.length > 0) && (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-xl px-4 lg:hidden">
          <Button
            size="xl"
            className="flex w-full items-center justify-between rounded-2xl shadow-lg"
            onClick={() => setCartOpen(true)}
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="size-5" aria-hidden />
              {t('shop.viewCart')} ({totalCartLines})
            </span>
            <EstimatedAmount
              value={subtotal.gt(0) ? estimatedTotal.toFixed(2) : '0.00'}
              className="font-display text-base font-extrabold"
            />
          </Button>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        onCheckout={handleCheckout}
        onSaveAsBasket={handleOpenSaveBasket}
        prunedNames={prunedNames}
        onDismissPruned={() => setPrunedNames([])}
      />

      <SaveCurrentBasketDialog
        open={saveBasketOpen}
        items={items}
        onClose={() => setSaveBasketOpen(false)}
      />
    </div>
  )
}
