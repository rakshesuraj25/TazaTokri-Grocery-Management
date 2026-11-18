import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fmtDate, fmtDateTime } from '@/lib/dates'
import { formatMoney, formatQty } from '@/lib/money'
import {
  getReceiptConfig,
  saveReceiptConfig,
  type ReceiptPaperWidth,
} from '@/features/sales/receiptSettings'
import type { OrderResponse } from '../types'

interface CustomerOrderReceiptDialogProps {
  order: OrderResponse | null
  onClose: () => void
}

/**
 * Determines whether a customer order has completed payment vs is an order confirmation.
 * Never shows a payment receipt for PENDING_PAYMENT or CANCELLED orders.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveOrderDocumentKind(
  order: OrderResponse,
): 'PAYMENT_RECEIPT' | 'ORDER_CONFIRMATION' | 'UNPAID_NOTICE' {
  if (order.status === 'CANCELLED' || order.status === 'PENDING_PAYMENT') {
    return 'UNPAID_NOTICE'
  }
  if (order.status === 'DELIVERED' || order.paymentMethod === 'ONLINE') {
    return 'PAYMENT_RECEIPT'
  }
  return 'ORDER_CONFIRMATION'
}

export function CustomerOrderReceiptDialog({
  order,
  onClose,
}: CustomerOrderReceiptDialogProps) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState(() => getReceiptConfig())

  const handlePaperWidthChange = (preferredWidth: ReceiptPaperWidth) => {
    const next = saveReceiptConfig({ preferredWidth })
    setSettings(next)
  }

  const handlePrint = () => {
    window.print()
  }

  const widthClass =
    settings.preferredWidth === '58mm'
      ? 'sm:max-w-[260px] receipt-width-58mm'
      : settings.preferredWidth === '80mm'
        ? 'sm:max-w-[340px] receipt-width-80mm'
        : 'sm:max-w-xl receipt-width-a4'

  const docKind = order ? resolveOrderDocumentKind(order) : 'ORDER_CONFIRMATION'
  const isPaidReceipt = docKind === 'PAYMENT_RECEIPT'
  const totalValue = order ? (order.finalTotal ?? order.estimatedTotal) : 0

  return (
    <Dialog
      open={order !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        data-paper-width={settings.preferredWidth}
        className={`printable-receipt-dialog ${widthClass}`}
      >
        <DialogHeader className="no-print">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>
              {isPaidReceipt
                ? t('orders.paymentReceiptTitle', { defaultValue: 'Payment Receipt' })
                : t('orders.orderConfirmationSlipTitle', {
                    defaultValue: 'Order Confirmation Slip',
                  })}
            </DialogTitle>
            <div
              className="border-border bg-surface-subtle inline-flex rounded-lg border p-0.5 text-xs"
              role="group"
              aria-label={t('sales.paperWidth', { defaultValue: 'Paper size' })}
            >
              {(['58mm', '80mm', 'A4'] as ReceiptPaperWidth[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => handlePaperWidthChange(w)}
                  className={`rounded-md px-2 py-1 font-semibold transition-colors ${
                    settings.preferredWidth === w
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {order && (
          <div
            data-testid="customer-order-printable-receipt"
            data-doc-kind={docKind}
            className="printable-receipt border-border bg-card text-foreground space-y-3 rounded-xl border p-4 font-mono text-xs"
          >
            <div className="border-border border-b border-dashed pb-2 text-center">
              <p className="font-display text-base font-extrabold tracking-tight">
                {settings.storeName}
              </p>
              {settings.storeAddress && (
                <p className="text-muted-foreground text-[11px]">{settings.storeAddress}</p>
              )}
              {settings.contactPhone && (
                <p className="text-muted-foreground text-[11px]">
                  Tel: {settings.contactPhone}
                </p>
              )}
              <p className="mt-1 inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase">
                {isPaidReceipt
                  ? t('orders.officialPaymentReceipt', {
                      defaultValue: 'PAYMENT RECEIPT (PAID)',
                    })
                  : t('orders.orderConfirmationSlip', {
                      defaultValue: 'ORDER CONFIRMATION (PAYMENT DUE ON DELIVERY)',
                    })}
              </p>
            </div>

            <div className="border-border space-y-1 border-b border-dashed pb-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('orders.orderRef', { defaultValue: 'Order Ref' })}:
                </span>
                <span className="font-bold">ORD-#{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('sales.receiptDate', { defaultValue: 'Date' })}:
                </span>
                <span>{fmtDateTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('orders.deliveryDateLabel', { defaultValue: 'Delivery Date' })}:
                </span>
                <span>{fmtDate(order.deliveryDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('sales.paymentMethod', { defaultValue: 'Payment' })}:
                </span>
                <span className="font-semibold">
                  {order.paymentMethod} •{' '}
                  {isPaidReceipt
                    ? t('sales.paymentStatusPaid', { defaultValue: 'PAID' })
                    : t('orders.paymentStatusDue', { defaultValue: 'DUE ON DELIVERY' })}
                </span>
              </div>
              <div className="pt-0.5 text-[10px]">
                <span className="text-muted-foreground">
                  {t('checkout.address', { defaultValue: 'Delivery Address' })}:{' '}
                </span>
                <span>
                  {order.deliveryAddress} ({order.deliveryPincode})
                </span>
              </div>
            </div>

            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-border text-muted-foreground border-b">
                  <th className="py-1 font-semibold">
                    {t('sales.receiptItem', { defaultValue: 'Item' })}
                  </th>
                  <th className="py-1 text-right font-semibold">
                    {t('sales.receiptQtyPrice', { defaultValue: 'Qty × Rate' })}
                  </th>
                  <th className="py-1 text-right font-semibold">
                    {t('sales.receiptAmount', { defaultValue: 'Amt' })}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y divide-dashed">
                {order.items.map((item, idx) => {
                  const qty = item.actualQuantity ?? item.quantity
                  const lineTotal = item.finalLineTotal ?? item.estimatedLineTotal
                  return (
                    <tr key={`${item.vegetableId}-${idx}`}>
                      <td className="py-1.5 pr-2 font-medium">{item.vegetableName}</td>
                      <td className="text-muted-foreground py-1.5 pr-2 text-right whitespace-nowrap">
                        {formatQty(qty)} × {formatMoney(item.unitPrice)}
                      </td>
                      <td className="py-1.5 text-right font-semibold whitespace-nowrap">
                        {formatMoney(lineTotal)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="border-border space-y-1 border-t border-dashed pt-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('cart.subtotal')}</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('cart.deliveryFee')}</span>
                <span>{formatMoney(order.deliveryFee)}</span>
              </div>
              <div className="border-border flex items-center justify-between border-t pt-1.5 text-sm font-bold">
                <span>
                  {order.finalTotal !== null
                    ? t('orders.finalBill')
                    : t('orders.estimatedBill')}
                </span>
                <span className="text-primary text-base font-extrabold">
                  {formatMoney(totalValue)}
                </span>
              </div>
            </div>

            <p className="text-muted-foreground pt-1 text-center text-[11px]">
              {settings.footerMessage}
            </p>
          </div>
        )}

        <DialogFooter className="no-print gap-2">
          <Button type="button" variant="outline" onClick={handlePrint}>
            <Printer className="size-4" aria-hidden />
            {t('sales.printReceipt', { defaultValue: 'Print Receipt' })}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('common.done', { defaultValue: 'Done' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
