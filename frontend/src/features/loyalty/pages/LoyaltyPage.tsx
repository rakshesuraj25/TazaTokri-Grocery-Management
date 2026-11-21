import { Link } from 'react-router-dom'
import { ArrowLeft, Award, Coins, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { ListSkeleton } from '@/components/Skeletons'
import { fmtDate, fmtTime } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useMyLoyalty } from '../api'

export default function LoyaltyPage() {
  const loyaltyQuery = useMyLoyalty()

  if (loyaltyQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <ListSkeleton rows={4} />
      </div>
    )
  }

  if (loyaltyQuery.isError || !loyaltyQuery.data) {
    return <ErrorState onRetry={() => void loyaltyQuery.refetch()} />
  }

  const data = loyaltyQuery.data

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link to="/shop/account" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-organic text-2xl font-bold">Loyalty & Rewards</h1>
      </div>

      <Card className="bg-primary text-primary-foreground space-y-3 rounded-3xl p-5 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
            <Award className="text-turmeric size-4" aria-hidden />
            Available Points Balance
          </span>
          <Badge variant="secondary">
            {data.enabled ? 'Program Active' : 'Program Paused'}
          </Badge>
        </div>
        <p className="font-display text-4xl font-extrabold" data-testid="loyalty-balance">
          {data.balance} pts
        </p>
        <p className="text-sm text-white/90">
          Worth {formatMoney(data.balance * data.rupeesPerPoint)} (1 point ={' '}
          {formatMoney(data.rupeesPerPoint)})
        </p>
        <div className="flex flex-wrap gap-3 border-t border-white/15 pt-3 text-xs text-white/85">
          <span>Earn {data.pointsPer100Inr} pts per ₹100 spent (excluding delivery fee)</span>
          <span>•</span>
          <span>
            Redeem {data.minRedeemPoints}–{data.maxRedeemPointsPerOrder} pts per order
          </span>
        </div>
      </Card>

      <Card className="space-y-3 p-4 sm:p-5">
        <h2 className="font-display flex items-center gap-2 text-base font-bold">
          <History className="text-primary size-4" aria-hidden />
          Points History
        </h2>

        {data.transactions.length === 0 ? (
          <EmptyState
            icon={<Coins className="size-7" aria-hidden />}
            title="No points activity yet"
            description="Complete an eligible order to start earning reward points."
            actionLabel="Shop Vegetables"
            actionTo="/shop"
          />
        ) : (
          <ul className="divide-y">
            {data.transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        tx.type === 'EARN'
                          ? 'success'
                          : tx.type === 'REDEEM'
                            ? 'secondary'
                            : 'warning'
                      }
                    >
                      {tx.type.replaceAll('_', ' ')}
                    </Badge>
                    {tx.orderId && (
                      <Link
                        to={`/shop/orders/${tx.orderId}`}
                        className="text-primary text-xs font-semibold hover:underline"
                      >
                        Order #{tx.orderId}
                      </Link>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {tx.description ?? 'Loyalty transaction'} · {fmtDate(tx.createdAt)}{' '}
                    {fmtTime(tx.createdAt)}
                  </p>
                </div>
                <span
                  className={`font-display shrink-0 font-bold ${
                    tx.points >= 0 ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {tx.points >= 0 ? `+${tx.points}` : tx.points} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
