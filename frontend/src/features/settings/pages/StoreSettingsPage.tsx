import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock, Loader2, MapPin, Plus, Save, Store, Trash2, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { toApiError } from '@/lib/api'
import { useStoreSettings, useUpdateStoreSettings } from '../hooks'
import { LoyaltySettingsCard } from '@/features/loyalty/components/LoyaltySettingsCard'

const INDIAN_PIN_REGEX = /^[1-9][0-9]{5}$/
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export default function StoreSettingsPage() {
  const settingsQuery = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()

  const [storeOpen, setStoreOpen] = useState(true)
  const [deliveryFee, setDeliveryFee] = useState('30')
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState('300')
  const [minOrder, setMinOrder] = useState('150')
  const [cutoffTime, setCutoffTime] = useState('18:00')
  const [pincodes, setPincodes] = useState<string[]>([])

  const [newPin, setNewPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinToRemove, setPinToRemove] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (settingsQuery.data) {
      setStoreOpen(settingsQuery.data.storeOpen)
      setDeliveryFee(String(settingsQuery.data.deliveryFee))
      setFreeDeliveryAbove(String(settingsQuery.data.freeDeliveryAbove))
      setMinOrder(String(settingsQuery.data.minOrder))
      setCutoffTime(settingsQuery.data.cutoffTime)
      setPincodes(settingsQuery.data.pincodes)
    }
  }, [settingsQuery.data])

  const handleAddPin = () => {
    const trimmed = newPin.trim()
    if (!INDIAN_PIN_REGEX.test(trimmed)) {
      setPinError('Enter a valid 6-digit Indian PIN code (e.g. 411026).')
      return
    }
    if (pincodes.includes(trimmed)) {
      setPinError(`PIN code ${trimmed} is already in the serviceable list.`)
      return
    }
    setPinError(null)
    setPincodes((prev) => [...prev, trimmed])
    setNewPin('')
  }

  const confirmRemovePin = () => {
    if (!pinToRemove) return
    if (pincodes.length <= 1) {
      setPinError('At least one serviceable PIN code is required.')
      setPinToRemove(null)
      return
    }
    setPincodes((prev) => prev.filter((p) => p !== pinToRemove))
    setPinToRemove(null)
    setPinError(null)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (updateMutation.isPending) return

    setFormError(null)
    setSaveSuccess(null)

    const feeNum = Number(deliveryFee)
    const freeNum = Number(freeDeliveryAbove)
    const minNum = Number(minOrder)

    if (pincodes.length === 0) {
      setFormError('At least one serviceable PIN code is required.')
      return
    }
    if (deliveryFee.trim() === '' || Number.isNaN(feeNum) || feeNum < 0) {
      setFormError('Delivery fee must be ₹0 or greater.')
      return
    }
    if (freeDeliveryAbove.trim() === '' || Number.isNaN(freeNum) || freeNum < 0) {
      setFormError('Free-delivery threshold must be ₹0 or greater.')
      return
    }
    if (minOrder.trim() === '' || Number.isNaN(minNum) || minNum < 0) {
      setFormError('Minimum order amount must be ₹0 or greater.')
      return
    }
    if (!TIME_24H_REGEX.test(cutoffTime.trim())) {
      setFormError('Order cutoff time must be in 24-hour HH:mm format (e.g. 18:00).')
      return
    }

    try {
      await updateMutation.mutateAsync({
        pincodes,
        minOrder: minNum,
        deliveryFee: feeNum,
        freeDeliveryAbove: freeNum,
        cutoffTime: cutoffTime.trim(),
        storeOpen,
      })
      const msg = 'Store settings saved.'
      setSaveSuccess(msg)
      toast.success(msg)
    } catch (err) {
      setFormError(toApiError(err).message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-5">
      <PageHeader
        title="Store Settings"
        breadcrumbs={[{ label: 'Team' }, { label: 'Store Settings' }]}
      />

      {settingsQuery.isPending || settingsQuery.isLoading ? (
        <div className="space-y-4">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      ) : settingsQuery.isError ? (
        <ErrorState onRetry={() => void settingsQuery.refetch()} />
      ) : (
        <form onSubmit={handleSave} noValidate className="space-y-5">
          {formError && (
            <div
              role="alert"
              className="bg-destructive/10 text-destructive border-destructive/20 rounded-xl border px-3.5 py-2.5 text-sm font-medium"
            >
              {formError}
            </div>
          )}
          {saveSuccess && (
            <div
              role="status"
              className="bg-primary/10 text-primary border-primary/20 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium"
            >
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              <span>{saveSuccess}</span>
            </div>
          )}

          {/* 1. Store & Availability */}
          <Card className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Store className="text-primary size-5" aria-hidden />
                <div>
                  <h2 className="font-display text-base font-bold">Store & Availability</h2>
                  <p className="text-muted-foreground text-xs">
                    Control whether customers can place new online orders. Existing orders are unaffected.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge variant={storeOpen ? 'success' : 'warning'}>
                  {storeOpen ? 'Open for orders' : 'Paused'}
                </Badge>
                <Switch
                  checked={storeOpen}
                  onCheckedChange={setStoreOpen}
                  aria-label="Store open for online orders"
                />
              </div>
            </div>
          </Card>

          {/* 2. Delivery Settings */}
          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Truck className="text-primary size-5" aria-hidden />
              <h2 className="font-display text-base font-bold">Delivery Settings</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-delivery-fee">Delivery fee (₹)</Label>
                <Input
                  id="settings-delivery-fee"
                  type="number"
                  min="0"
                  step="1"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Currently ₹{Number(deliveryFee || 0).toLocaleString('en-IN')} per order below threshold.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settings-free-above">Free-delivery threshold (₹)</Label>
                <Input
                  id="settings-free-above"
                  type="number"
                  min="0"
                  step="1"
                  value={freeDeliveryAbove}
                  onChange={(e) => setFreeDeliveryAbove(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Free delivery on orders ₹{Number(freeDeliveryAbove || 0).toLocaleString('en-IN')} or above.
                </p>
              </div>
            </div>
          </Card>

          {/* 3. Serviceable PIN Codes */}
          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="text-primary size-5" aria-hidden />
                <div>
                  <h2 className="font-display text-base font-bold">Serviceable PIN Codes</h2>
                  <p className="text-muted-foreground text-xs">
                    Customers can add addresses and place orders only for these 6-digit Indian PIN codes.
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{pincodes.length} active</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {pincodes.map((pin) => (
                <div
                  key={pin}
                  className="bg-secondary/60 flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
                >
                  <span>{pin}</span>
                  <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                    Serviceable
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setPinToRemove(pin)}
                    aria-label={`Remove PIN ${pin}`}
                    className="text-muted-foreground hover:text-destructive inline-flex min-h-7 min-w-7 items-center justify-center rounded-full p-1"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="settings-new-pin">Add 6-digit PIN code</Label>
                <Input
                  id="settings-new-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="e.g. 411057"
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value)
                    if (pinError) setPinError(null)
                  }}
                />
              </div>
              <Button type="button" variant="outline" onClick={handleAddPin} className="shrink-0">
                <Plus className="size-4" aria-hidden />
                Add PIN
              </Button>
            </div>
            {pinError && (
              <p role="alert" className="text-destructive text-xs font-medium">
                {pinError}
              </p>
            )}
          </Card>

          {/* 4. Order Rules */}
          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Clock className="text-primary size-5" aria-hidden />
              <h2 className="font-display text-base font-bold">Order Rules</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-min-order">Minimum order amount (₹)</Label>
                <Input
                  id="settings-min-order"
                  type="number"
                  min="0"
                  step="1"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Minimum subtotal ₹{Number(minOrder || 0).toLocaleString('en-IN')} required for delivery.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settings-cutoff">Order cutoff time (IST, 24h HH:mm)</Label>
                <Input
                  id="settings-cutoff"
                  type="time"
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Orders placed after {cutoffTime || '18:00'} IST schedule for next-day delivery.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending} className="rounded-full px-6">
              {updateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {updateMutation.isPending ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </form>
      )}

      <LoyaltySettingsCard />

      <Dialog open={!!pinToRemove} onOpenChange={(open) => !open && setPinToRemove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove PIN code {pinToRemove}?</DialogTitle>
            <DialogDescription>
              Customers in PIN {pinToRemove} will no longer be able to place new delivery orders once
              you save settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPinToRemove(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemovePin}>
              Remove PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
