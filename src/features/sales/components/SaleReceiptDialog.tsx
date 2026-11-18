import { useTranslation } from 'react-i18next'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { fmtTime } from '@/lib/dates'
import { formatQty } from '@/lib/money'
import { buildWhatsAppReceiptText } from '../quickSaleHelpers'
import type { SaleResponse } from '../types'

interface SaleReceiptDialogProps {
  sale: SaleResponse | null
  onClose: () => void
}

/** Shows the server-calculated bill after a shop sale succeeds. */
export function SaleReceiptDialog({ sale, onClose }: SaleReceiptDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={Boolean(sale)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {sale && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-6" aria-hidden />
                <DialogTitle>{t('staff.sale.billReceipt', { id: sale.id })}</DialogTitle>
              </div>
              <div className="flex items-center gap-2 pt-1 text-xs">
                <Badge variant="secondary">{sale.paymentMethod}</Badge>
                <span className="text-muted-foreground">{fmtTime(sale.createdAt)}</span>
              </div>
            </DialogHeader>

            <ul className="divide-border divide-y rounded-lg border text-sm">
              {sale.items.map((item) => (
                <li
                  key={String(item.vegetableId)}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <VegetableImage nameEn={item.vegetableName} size="xs" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.vegetableName}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatQty(item.quantity)} × <MoneyDisplay value={item.unitPrice} />
                      </p>
                    </div>
                  </div>
                  <MoneyDisplay value={item.lineTotal} className="shrink-0 font-display font-bold" />
                </li>
              ))}
            </ul>

            <div className="bg-secondary flex items-center justify-between rounded-xl px-4 py-3">
              <span className="font-semibold">{t('orders.finalBill')}</span>
              <MoneyDisplay
                value={sale.totalAmount}
                className="font-display text-primary text-xl font-extrabold"
              />
            </div>

            <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" size="lg" className="w-full" asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(buildWhatsAppReceiptText(sale))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4" />
                  {t('staff.sale.whatsappReceipt', { defaultValue: 'WhatsApp receipt' })}
                </a>
              </Button>
              <Button size="lg" className="w-full" onClick={onClose}>
                {t('staff.sale.newSale')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
