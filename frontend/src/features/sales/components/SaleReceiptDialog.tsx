import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, MessageCircle, Printer, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { VegetableImage } from '@/components/VegetableImage'
import { useAuthStore } from '@/features/auth/store'
import { useStaffCatalog } from '@/features/catalog/hooks'
import { fmtDateTime } from '@/lib/dates'
import { formatQty } from '@/lib/money'
import { buildWhatsAppReceiptText, calculateReceiptSummary } from '../quickSaleHelpers'
import {
  getReceiptConfig,
  saveReceiptConfig,
  type ReceiptPaperWidth,
  type StoreReceiptConfig,
} from '../receiptSettings'
import type { SaleResponse } from '../types'

interface SaleReceiptDialogProps {
  sale: SaleResponse | null
  onClose: () => void
}

const PAPER_WIDTHS: ReceiptPaperWidth[] = ['58mm', '80mm', 'A4']

/**
 * Shows the server-calculated bill after a shop sale succeeds, supporting
 * 58mm thermal, 80mm thermal, and A4 paper widths via browser printing.
 */
export function SaleReceiptDialog({ sale, onClose }: SaleReceiptDialogProps) {
  const { t } = useTranslation()
  const catalog = useStaffCatalog()
  const user = useAuthStore((s) => s.user)

  const [config, setConfig] = useState<StoreReceiptConfig>(() => getReceiptConfig())
  const [editingSettings, setEditingSettings] = useState(false)

  const unitByVegId = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of catalog.data ?? []) {
      map.set(String(item.id), item.baseUnit)
    }
    return map
  }, [catalog.data])

  const summary = useMemo(
    () => (sale ? calculateReceiptSummary(sale) : null),
    [sale],
  )

  const handleWidthChange = (width: ReceiptPaperWidth) => {
    const next = saveReceiptConfig({ preferredWidth: width })
    setConfig(next)
  }

  const handleSaveSettings = () => {
    const next = saveReceiptConfig(config)
    setConfig(next)
    setEditingSettings(false)
    toast.success(
      t('staff.sale.receiptSettingsSaved', {
        defaultValue: 'Receipt settings saved',
      }),
    )
  }

  const cashierLabel =
    user?.fullName || (sale?.soldBy ? `Staff #${sale.soldBy}` : 'Counter Staff')

  const widthClass =
    config.preferredWidth === '58mm'
      ? 'receipt-width-58mm max-w-[260px] mx-auto text-[11px]'
      : config.preferredWidth === '80mm'
        ? 'receipt-width-80mm max-w-[340px] mx-auto text-xs'
        : 'receipt-width-a4 max-w-lg mx-auto text-sm'

  return (
    <Dialog open={Boolean(sale)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="printable-receipt-dialog max-h-[90dvh] max-w-lg overflow-y-auto">
        {sale && summary && (
          <div className="space-y-4">
            {/* Paper width selector & Settings toggle (hidden when printing) */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 print:hidden">
              <div
                className="bg-muted inline-flex rounded-full p-0.5"
                role="radiogroup"
                aria-label={t('staff.sale.receiptWidth', {
                  defaultValue: 'Receipt paper width',
                })}
              >
                {PAPER_WIDTHS.map((w) => {
                  const active = config.preferredWidth === w
                  return (
                    <button
                      key={w}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => handleWidthChange(w)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {w}
                    </button>
                  )
                })}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingSettings((v) => !v)}
                className="rounded-full text-xs"
              >
                <Settings2 className="size-3.5" aria-hidden />
                {t('staff.sale.receiptSettingsBtn', {
                  defaultValue: 'Store receipt header',
                })}
              </Button>
            </div>

            {editingSettings && (
              <div className="bg-surface-subtle/60 space-y-2.5 rounded-xl border p-3 text-xs print:hidden">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="rcpt-store-name" className="text-xs">
                      Store name
                    </Label>
                    <Input
                      id="rcpt-store-name"
                      value={config.storeName}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, storeName: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rcpt-store-phone" className="text-xs">
                      Contact phone
                    </Label>
                    <Input
                      id="rcpt-store-phone"
                      value={config.contactPhone}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, contactPhone: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rcpt-store-address" className="text-xs">
                    Store address
                  </Label>
                  <Input
                    id="rcpt-store-address"
                    value={config.storeAddress}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, storeAddress: e.target.value }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rcpt-footer" className="text-xs">
                    Footer message
                  </Label>
                  <Input
                    id="rcpt-footer"
                    value={config.footerMessage}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, footerMessage: e.target.value }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSettings(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="button" size="sm" onClick={handleSaveSettings}>
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            )}

            <div
              data-testid="sale-receipt"
              data-receipt-width={config.preferredWidth}
              className={`printable-receipt space-y-3 ${widthClass}`}
            >
              <DialogHeader className="border-border border-b border-dashed pb-3 text-center sm:text-center">
                <div className="flex items-center justify-center gap-2 print:hidden">
                  <CheckCircle2 className="text-primary size-5" aria-hidden />
                  <DialogTitle className="text-base">
                    {t('staff.sale.billReceipt', { id: sale.id })}
                  </DialogTitle>
                </div>

                <div className="space-y-0.5 pt-1">
                  <p className="font-display text-foreground text-lg font-extrabold tracking-tight">
                    {config.storeName}
                  </p>
                  {config.storeAddress && (
                    <p className="text-muted-foreground text-[11px] leading-snug">
                      {config.storeAddress}
                    </p>
                  )}
                  {config.contactPhone && (
                    <p className="text-muted-foreground font-mono text-[11px]">
                      Tel: {config.contactPhone}
                    </p>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-left text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold">
                      {t('staff.sale.receiptNo', { defaultValue: 'Receipt' })}: #{sale.id}
                    </span>
                    <span className="text-muted-foreground">
                      {fmtDateTime(sale.createdAt)} IST
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {t('staff.sale.cashierLabel', { defaultValue: 'Staff' })}: {cashierLabel}
                    </span>
                    <span className="font-mono">Ref: SALE-{sale.id}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {t('staff.sale.paymentMethod', { defaultValue: 'Payment' })}:{' '}
                      <strong>{sale.paymentMethod}</strong>
                    </span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      PAID
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead className="bg-muted/50 border-b text-[10px] uppercase">
                    <tr>
                      <th className="px-2 py-1.5">{t('orders.items', { defaultValue: 'Item' })}</th>
                      <th className="px-1.5 py-1.5 text-right">
                        {t('staff.sale.quantity', { defaultValue: 'Qty' })}
                      </th>
                      <th className="px-1.5 py-1.5 text-right">
                        {t('staff.pricing.rate', { defaultValue: 'Rate' })}
                      </th>
                      <th className="px-2 py-1.5 text-right">
                        {t('common.total', { defaultValue: 'Total' })}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {sale.items.map((item) => {
                      const resolvedUnit =
                        item.baseUnit ?? unitByVegId.get(String(item.vegetableId)) ?? ''
                      const unitLabel = resolvedUnit
                        ? t(`units.${resolvedUnit}`, { defaultValue: resolvedUnit })
                        : ''
                      return (
                        <tr key={String(item.vegetableId)} className="break-inside-avoid">
                          <td className="px-2 py-1.5">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="print:hidden">
                                <VegetableImage nameEn={item.vegetableName} size="xs" />
                              </span>
                              <span className="font-semibold break-words">
                                {item.vegetableName}
                              </span>
                            </div>
                          </td>
                          <td className="money-num whitespace-nowrap px-1.5 py-1.5 text-right">
                            {formatQty(item.quantity)}
                            {unitLabel ? ` ${unitLabel}` : ''}
                          </td>
                          <td className="money-num whitespace-nowrap px-1.5 py-1.5 text-right">
                            <MoneyDisplay value={item.unitPrice} />
                          </td>
                          <td className="money-num whitespace-nowrap px-2 py-1.5 text-right font-display font-bold">
                            <MoneyDisplay value={item.lineTotal} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-border space-y-1.5 border-t border-dashed pt-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t('cart.subtotal', { defaultValue: 'Subtotal' })}
                  </span>
                  <MoneyDisplay value={summary.subtotal} className="money-num font-semibold" />
                </div>

                {summary.hasDiscount && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t('staff.sale.discount', { defaultValue: 'Discount' })}
                    </span>
                    <span className="money-num text-primary font-semibold">
                      −<MoneyDisplay value={summary.discount} />
                    </span>
                  </div>
                )}

                <div className="bg-secondary flex items-center justify-between rounded-xl px-3 py-2">
                  <span className="font-semibold">{t('orders.finalBill')}</span>
                  <MoneyDisplay
                    value={summary.finalAmount}
                    className="font-display text-primary text-lg font-extrabold"
                  />
                </div>
              </div>

              <p className="text-muted-foreground text-center text-[11px] font-medium">
                {config.footerMessage ||
                  t('staff.sale.thankYouMessage', {
                    defaultValue: 'Thank you for shopping fresh at TazaTokri!',
                  })}
              </p>
            </div>

            <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-3 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => window.print()}
              >
                <Printer className="size-4" aria-hidden />
                {t('staff.sale.printReceipt', { defaultValue: 'Print receipt' })}
              </Button>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
