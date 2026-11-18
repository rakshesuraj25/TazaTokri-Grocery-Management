import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag } from 'lucide-react'
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
import { toApiError } from '@/lib/api'
import { formatInr, formatQty } from '@/lib/money'
import type { BaseUnit } from '@/features/catalog/types'
import { useApplyMarkdownPrice } from '../hooks'

export interface MarkdownTargetVegetable {
  vegetableId: number | string
  nameEn: string
  baseUnit: BaseUnit
  currentStock: string | number
  currentPrice?: string | number | null
  landedCost?: string | number | null
}

interface MarkdownPriceDialogProps {
  target: MarkdownTargetVegetable | null
  onClose: () => void
}

export function MarkdownPriceDialog({ target, onClose }: MarkdownPriceDialogProps) {
  const { t } = useTranslation()
  const applyMarkdown = useApplyMarkdownPrice()
  const [markdownPrice, setMarkdownPrice] = useState('')
  const [reason, setReason] = useState('End-of-day freshness clearance')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (target) {
      const cur = Number(target.currentPrice ?? 0)
      if (cur > 1) {
        const suggested = Math.max(1, Math.round(cur * 0.85))
        setMarkdownPrice(String(suggested))
      } else {
        setMarkdownPrice('')
      }
      setReason('End-of-day freshness clearance')
      setError(null)
    }
  }, [target])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!target) return
    setError(null)

    const num = Number(markdownPrice)
    if (!Number.isFinite(num) || num <= 0) {
      setError(
        t('pricing.markdownInvalidPrice', {
          defaultValue: 'Enter a valid markdown price greater than ₹0.',
        }),
      )
      return
    }
    const cur = Number(target.currentPrice ?? 0)
    if (cur > 0 && num >= cur) {
      setError(
        t('pricing.markdownMustBeLower', {
          defaultValue: `Markdown price must be lower than current price (${formatInr(cur)}).`,
        }),
      )
      return
    }

    applyMarkdown.mutate(
      {
        vegId: target.vegetableId,
        body: {
          markdownPricePerUnit: num.toFixed(2),
          reason: reason.trim() || 'End-of-day freshness clearance',
        },
      },
      {
        onSuccess: () => {
          toast.success(
            t('pricing.markdownSuccess', {
              defaultValue: `Markdown price applied for ${target.nameEn}`,
            }),
          )
          onClose()
        },
        onError: (err) => {
          setError(toApiError(err).message)
        },
      },
    )
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="text-primary size-4" aria-hidden />
            {t('pricing.markdownTitle', {
              defaultValue: 'Staff Markdown / Clearance Price',
            })}
          </DialogTitle>
          <DialogDescription>
            {t('pricing.markdownDesc', {
              defaultValue:
                'Apply a staff-approved reduced selling price to clear ageing but sellable stock. Spoiled items must be recorded as Wastage instead.',
            })}
          </DialogDescription>
        </DialogHeader>

        {target && (
          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <div className="bg-surface-subtle space-y-1 rounded-xl p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('staff.stock.vegetable', { defaultValue: 'Vegetable' })}:
                </span>
                <span className="font-bold">{target.nameEn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('staff.stock.currentStock', { defaultValue: 'Current Stock' })}:
                </span>
                <span className="font-semibold">
                  {formatQty(target.currentStock)} {target.baseUnit}
                </span>
              </div>
              {target.currentPrice != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('pricing.currentPrice', { defaultValue: 'Current Selling Price' })}:
                  </span>
                  <span className="font-semibold">
                    {formatInr(target.currentPrice)} / {target.baseUnit}
                  </span>
                </div>
              )}
              {target.landedCost != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('pricing.landedCost', { defaultValue: 'Purchase Landed Cost' })}:
                  </span>
                  <span>
                    {formatInr(target.landedCost)} / {target.baseUnit}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="markdown-price-input">
                {t('pricing.newMarkdownPrice', {
                  defaultValue: `Reduced Selling Price (₹ per ${target.baseUnit})`,
                })}
              </Label>
              <Input
                id="markdown-price-input"
                type="number"
                step="0.01"
                min="0.01"
                value={markdownPrice}
                onChange={(e) => setMarkdownPrice(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="markdown-reason-input">
                {t('pricing.markdownReason', { defaultValue: 'Clearance Reason' })}
              </Label>
              <Input
                id="markdown-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="End-of-day freshness clearance"
                required
              />
            </div>

            {error && (
              <p role="alert" className="text-destructive text-xs font-medium">
                {error}
              </p>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={applyMarkdown.isPending}>
                {t('pricing.applyMarkdownBtn', { defaultValue: 'Apply Markdown Price' })}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
