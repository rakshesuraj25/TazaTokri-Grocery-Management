import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Delete } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { dec } from '@/lib/money'

interface ExactWeightKeypadProps {
  open: boolean
  itemName: string
  unitLabel: string
  initialValue: string
  onOpenChange: (open: boolean) => void
  onConfirm: (nextQty: string) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0']

/** Touch-friendly numeric keypad for entering exact counter weights (up to 3 decimals). */
export function ExactWeightKeypad({
  open,
  itemName,
  unitLabel,
  initialValue,
  onOpenChange,
  onConfirm,
}: ExactWeightKeypadProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  const appendKey = (k: string) => {
    setValue((prev) => {
      if (k === '.' && prev.includes('.')) return prev
      const next = prev === '0' && k !== '.' ? k : `${prev}${k}`
      const dot = next.indexOf('.')
      if (dot !== -1 && next.length - dot - 1 > 3) return prev
      return next
    })
  }

  const valid = Boolean(value) && value !== '.' && dec(value || 0).gt(0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>
            {itemName} ({unitLabel})
          </DialogTitle>
        </DialogHeader>

        <div className="bg-secondary/70 rounded-xl border px-4 py-3 text-right font-mono text-2xl font-bold">
          {value || '0'} <span className="text-muted-foreground text-sm">{unitLabel}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <Button
              key={k}
              type="button"
              variant="outline"
              size="lg"
              className="h-12 text-lg font-bold"
              onClick={() => appendKey(k)}
            >
              {k}
            </Button>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            aria-label={t('common.back')}
            className="h-12"
            onClick={() => setValue((prev) => prev.slice(0, -1))}
          >
            <Delete className="size-5" />
          </Button>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button type="button" variant="ghost" onClick={() => setValue('')}>
            {t('staff.sale.clearBill')}
          </Button>
          <Button
            type="button"
            disabled={!valid}
            onClick={() => {
              if (!valid) return
              onConfirm(value)
              onOpenChange(false)
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
