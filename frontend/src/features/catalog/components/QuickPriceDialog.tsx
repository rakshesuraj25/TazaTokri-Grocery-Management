import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { useSetPrice } from '@/features/pricing/hooks'
import { toApiError } from '@/lib/api'
import type { BaseUnit } from '../types'

export interface QuickPriceTarget {
  id: string | number
  name: string
  baseUnit: BaseUnit
  currentPrice: string | number | null
}

interface QuickPriceDialogProps {
  target: QuickPriceTarget | null
  onClose: () => void
}

export function QuickPriceDialog({ target, onClose }: QuickPriceDialogProps) {
  const setPrice = useSetPrice()
  const [price, setPriceValue] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (target) {
      setPriceValue(target.currentPrice !== null ? String(target.currentPrice) : '')
      setErrorMsg(null)
    }
  }, [target])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!target || setPrice.isPending) return

    const numeric = Number(price)
    if (!price.trim() || Number.isNaN(numeric) || numeric <= 0) {
      setErrorMsg('Enter a valid selling price greater than 0.')
      return
    }

    setErrorMsg(null)
    try {
      await setPrice.mutateAsync({
        vegId: target.id,
        body: { pricePerUnit: numeric.toFixed(2) },
      })
      toast.success(`Updated selling price for ${target.name}`)
      onClose()
    } catch (err) {
      setErrorMsg(toApiError(err).message)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target?.currentPrice !== null ? 'Update selling price' : 'Set selling price'}
          </DialogTitle>
          <DialogDescription>
            {target
              ? `Set the selling price per ${target.baseUnit} for ${target.name}. Inventory quantities remain unchanged.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="bg-destructive/10 text-destructive border-destructive/20 rounded-xl border px-3 py-2 text-sm font-medium"
            >
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="quick-price-input">
              Selling price (₹ per {target?.baseUnit ?? 'unit'})
            </Label>
            <Input
              id="quick-price-input"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPriceValue(e.target.value)}
              placeholder="e.g. 40"
              disabled={setPrice.isPending}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={setPrice.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={setPrice.isPending}>
              {setPrice.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Tag className="size-4" aria-hidden />
              )}
              {setPrice.isPending ? 'Saving...' : 'Save price'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
