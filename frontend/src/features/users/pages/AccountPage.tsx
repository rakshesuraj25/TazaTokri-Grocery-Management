import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  Heart,
  LogOut,
  MapPin,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { MoneyDisplay, EstimatedAmount } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { ListSkeleton } from '@/components/Skeletons'
import { Stat } from '@/components/Stat'
import { StatusBadge } from '@/components/StatusBadge'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { useAuthStore } from '@/features/auth/store'
import { useLogout } from '@/features/auth/hooks'
import { useCartStore } from '@/features/cart/store'
import { usePublicVegetables } from '@/features/catalog/hooks'
import { useFavouritesStore } from '@/features/catalog/favouritesStore'
import { useCustomerOrders } from '@/features/orders/hooks'
import { buildUsualVegetables, mapOrderItemsToCart } from '@/features/orders/orderAgain'
import { fmtDate } from '@/lib/dates'
import { useCustomerAddresses } from '../hooks'
import { AddAddressDialog } from '../components/AddAddressDialog'

export default function AccountPage() {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const addresses = useCustomerAddresses()
  const catalog = usePublicVegetables()
  const pastOrders = useCustomerOrders(0)
  const addItem = useCartStore((s) => s.addItem)
  const favouriteIds = useFavouritesStore((s) => s.ids)
  const [addOpen, setAddOpen] = useState(false)

  const favouriteVegetables = useMemo(
    () => (catalog.data ?? []).filter((v) => favouriteIds.includes(String(v.id))),
    [catalog.data, favouriteIds],
  )

  const usualVegetables = useMemo(
    () => buildUsualVegetables(pastOrders.data ?? [], catalog.data ?? [], 4),
    [pastOrders.data, catalog.data],
  )

  const recentOrdersList = (pastOrders.data ?? []).slice(0, 3)
  const recentCompletedOrder = (pastOrders.data ?? []).find((o) => o.status !== 'CANCELLED')

  const handleOrderAgain = () => {
    if (!recentCompletedOrder || !catalog.data) return
    const { matched, skipped } = mapOrderItemsToCart(recentCompletedOrder.items, catalog.data)
    for (const item of matched) addItem(item)
    if (skipped.length > 0) {
      toast.info(
        t('orders.orderAgainPartial', {
          items: skipped.join(', '),
          defaultValue: `Added ${matched.length} item(s). Skipped unavailable: ${skipped.join(', ')}`,
        }),
      )
    } else if (matched.length > 0) {
      toast.success(t('orders.orderAgainAdded', { defaultValue: 'Added items to your cart' }))
    }
    if (matched.length > 0) navigate('/shop')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <PageHeader
        title={t('nav.account')}
        serif
        weave
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <Button variant="outline" size="sm" onClick={logout} className="rounded-full">
              <LogOut className="size-4" aria-hidden />
              {t('common.logout')}
            </Button>
          </div>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="bg-primary text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-xs">
              <User className="size-7" aria-hidden />
            </div>
            <div className="space-y-1">
              <h2 className="font-organic text-xl font-bold">
                {user?.fullName || user?.phone || t(`roles.${user?.roles[0] ?? 'CUSTOMER'}`)}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {user?.phone && (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                    <Phone className="size-3.5" aria-hidden />
                    {user.phone}
                  </span>
                )}
                {user?.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="rounded-full">
                    {t(`roles.${r}`)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {recentCompletedOrder && catalog.data && (
            <Button size="sm" onClick={handleOrderAgain} className="rounded-full">
              <RotateCcw className="size-4" aria-hidden />
              {t('orders.orderAgain', { defaultValue: 'Order again' })} (#{recentCompletedOrder.id})
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label={t('addresses.title')}
          value={(addresses.data ?? []).length}
          tone="positive"
          icon={<MapPin className="size-5" />}
        />
        <Stat
          label={t('orders.title')}
          value={(pastOrders.data ?? []).length}
          tone="neutral"
          icon={<Package className="size-5" />}
        />
        <Stat
          label={t('shop.favourites', { defaultValue: 'Favourites' })}
          value={favouriteIds.length}
          tone="danger"
          icon={<Heart className="size-5" />}
        />
      </div>

      {/* Saved Addresses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-1.5 text-lg font-bold">
            <MapPin className="text-primary size-5" aria-hidden />
            {t('addresses.title')}
          </h2>
          <Button size="sm" onClick={() => setAddOpen(true)} className="rounded-full">
            <Plus className="size-4" aria-hidden />
            {t('addresses.add')}
          </Button>
        </div>

        {addresses.isPending || addresses.isLoading ? (
          <ListSkeleton rows={2} />
        ) : addresses.isError ? (
          <ErrorState onRetry={() => void addresses.refetch()} />
        ) : (addresses.data ?? []).length === 0 ? (
          <EmptyState
            icon={<MapPin className="size-8" aria-hidden />}
            title={t('common.noData')}
            actionLabel={t('addresses.add')}
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(addresses.data ?? []).map((addr) => (
              <Card key={String(addr.id)} className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-display font-bold">{addr.label}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''} — {addr.pincode}
                  </p>
                </div>
                {addr.defaultAddress && (
                  <Badge variant="secondary" className="shrink-0 rounded-full">
                    {t('addresses.defaultBadge', { defaultValue: 'Default' })}
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent Order History */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-1.5 text-lg font-bold">
            <Package className="text-primary size-5" aria-hidden />
            {t('orders.title')}
          </h2>
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/shop/orders">
              {t('common.viewAll', { defaultValue: 'View all' })}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        </div>

        {recentOrdersList.length === 0 ? (
          <Card className="text-muted-foreground p-4 text-sm">{t('orders.noOrders')}</Card>
        ) : (
          <div className="space-y-2.5">
            {recentOrdersList.map((order) => (
              <Card key={String(order.id)} asChild>
                <Link
                  to={`/shop/orders/${order.id}`}
                  className="hover:border-primary/40 flex flex-wrap items-center justify-between gap-3 p-4 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold">#{order.id}</span>
                    <StatusBadge kind="order" status={order.status} />
                    <span className="text-muted-foreground text-xs">{fmtDate(order.deliveryDate)}</span>
                  </div>
                  {order.finalTotal !== null ? (
                    <MoneyDisplay value={order.finalTotal} className="font-display text-primary font-extrabold" />
                  ) : (
                    <EstimatedAmount value={order.estimatedTotal} className="font-display text-primary font-extrabold" />
                  )}
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      {usualVegetables.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display flex items-center gap-1.5 text-base font-bold">
            <Sparkles className="text-primary size-4" aria-hidden />
            {t('shop.yourUsual', { defaultValue: 'Your usual' })}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {usualVegetables.map((v) => (
              <Card key={v.id} className="flex items-center gap-2.5 p-2.5">
                <VegetableImage nameEn={v.nameEn} category={v.category} size="xs" />
                <span className="truncate text-xs font-semibold">{name(v)}</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {favouriteVegetables.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display flex items-center gap-1.5 text-base font-bold">
            <Heart className="text-tomato size-4" aria-hidden />
            {t('shop.favourites', { defaultValue: 'Favourites' })}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {favouriteVegetables.map((v) => (
              <Card key={v.id} className="flex items-center gap-2.5 p-2.5">
                <VegetableImage nameEn={v.nameEn} category={v.category} size="xs" />
                <span className="truncate text-xs font-semibold">{name(v)}</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      <AddAddressDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
