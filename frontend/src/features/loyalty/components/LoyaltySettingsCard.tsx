import { useEffect, useState } from 'react'
import { Award, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toApiError } from '@/lib/api'
import {
  DEFAULT_LOYALTY_SETTINGS,
  useOwnerLoyaltySettings,
  useUpdateOwnerLoyaltySettings,
} from '../api'

export function LoyaltySettingsCard() {
  const query = useOwnerLoyaltySettings()
  const update = useUpdateOwnerLoyaltySettings()

  const [enabled, setEnabled] = useState(DEFAULT_LOYALTY_SETTINGS.enabled)
  const [pointsPer100Inr, setPointsPer100Inr] = useState(
    String(DEFAULT_LOYALTY_SETTINGS.pointsPer100Inr),
  )
  const [rupeesPerPoint, setRupeesPerPoint] = useState(
    String(DEFAULT_LOYALTY_SETTINGS.rupeesPerPoint),
  )
  const [minRedeemPoints, setMinRedeemPoints] = useState(
    String(DEFAULT_LOYALTY_SETTINGS.minRedeemPoints),
  )
  const [maxRedeemPointsPerOrder, setMaxRedeemPointsPerOrder] = useState(
    String(DEFAULT_LOYALTY_SETTINGS.maxRedeemPointsPerOrder),
  )
  const [expiryDays, setExpiryDays] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!query.data) return
    setEnabled(query.data.enabled)
    setPointsPer100Inr(String(query.data.pointsPer100Inr))
    setRupeesPerPoint(String(query.data.rupeesPerPoint))
    setMinRedeemPoints(String(query.data.minRedeemPoints))
    setMaxRedeemPointsPerOrder(String(query.data.maxRedeemPointsPerOrder))
    setExpiryDays(query.data.expiryDays ? String(query.data.expiryDays) : '')
  }, [query.data])

  const handleSave = () => {
    setError(null)
    const earnRate = Number(pointsPer100Inr)
    const rupeeRate = Number(rupeesPerPoint)
    const minPts = Number(minRedeemPoints)
    const maxPts = Number(maxRedeemPointsPerOrder)
    const exp = expiryDays.trim() === '' ? null : Number(expiryDays)

    if (!Number.isFinite(earnRate) || earnRate < 0) {
      setError('Points per ₹100 must be 0 or greater.')
      return
    }
    if (!Number.isFinite(rupeeRate) || rupeeRate <= 0) {
      setError('Rupees per point must be greater than 0.')
      return
    }
    if (!Number.isInteger(minPts) || minPts < 1) {
      setError('Minimum redeem points must be at least 1.')
      return
    }
    if (!Number.isInteger(maxPts) || maxPts < minPts) {
      setError('Maximum redeem points per order must be >= minimum redeem points.')
      return
    }
    if (exp !== null && (!Number.isInteger(exp) || exp < 1)) {
      setError('Expiry days must be at least 1 when set.')
      return
    }

    update.mutate(
      {
        enabled,
        pointsPer100Inr: earnRate,
        rupeesPerPoint: rupeeRate,
        minRedeemPoints: minPts,
        maxRedeemPointsPerOrder: maxPts,
        expiryDays: exp,
      },
      {
        onSuccess: () => toast.success('Loyalty settings updated'),
        onError: (err) => setError(toApiError(err).message),
      },
    )
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="text-primary size-5" aria-hidden />
          <div>
            <h2 className="font-display text-base font-bold">Loyalty & Rewards Program</h2>
            <p className="text-muted-foreground text-xs">
              Configure points earning and checkout redemption rules.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="loyalty-enabled" className="text-xs font-semibold">
            {enabled ? 'Enabled' : 'Disabled'}
          </Label>
          <Switch id="loyalty-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-tomato-light text-tomato rounded-xl p-3 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="loyalty-earn-rate">Points per ₹100 spent</Label>
          <Input
            id="loyalty-earn-rate"
            type="number"
            min="0"
            step="0.5"
            value={pointsPer100Inr}
            onChange={(e) => setPointsPer100Inr(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loyalty-rupee-rate">₹ value per point</Label>
          <Input
            id="loyalty-rupee-rate"
            type="number"
            min="0.01"
            step="0.25"
            value={rupeesPerPoint}
            onChange={(e) => setRupeesPerPoint(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loyalty-min-pts">Min redeem points</Label>
          <Input
            id="loyalty-min-pts"
            type="number"
            min="1"
            value={minRedeemPoints}
            onChange={(e) => setMinRedeemPoints(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loyalty-max-pts">Max redeem per order</Label>
          <Input
            id="loyalty-max-pts"
            type="number"
            min="1"
            value={maxRedeemPointsPerOrder}
            onChange={(e) => setMaxRedeemPointsPerOrder(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loyalty-expiry">Points expiry (days, optional)</Label>
          <Input
            id="loyalty-expiry"
            type="number"
            min="1"
            placeholder="No expiry"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={update.isPending}
          onClick={handleSave}
          className="rounded-full"
        >
          {update.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          Save loyalty settings
        </Button>
      </div>
    </Card>
  )
}
