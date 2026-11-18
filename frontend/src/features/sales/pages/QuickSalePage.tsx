import { useTranslation } from 'react-i18next'
import { FilePlus2, History, Receipt, RotateCcw, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EstimatedAmount } from '@/components/MoneyDisplay'
import { PageHeader } from '@/components/PageHeader'
import { useVegetableName } from '@/hooks/useVegetableName'
import { dec } from '@/lib/money'
import { useQuickSaleController } from '../useQuickSaleController'
import { QuickSaleCatalogPanel } from '../components/QuickSaleCatalogPanel'
import { QuickSaleBill } from '../components/QuickSaleBill'
import { ExactWeightKeypad } from '../components/ExactWeightKeypad'
import { SaleReceiptDialog } from '../components/SaleReceiptDialog'
import { RecentSalesTab } from '../components/RecentSalesTab'

export default function QuickSalePage() {
  const { t } = useTranslation()
  const { name } = useVegetableName()
  const ctrl = useQuickSaleController()

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 pb-28 lg:pb-6">
      <Tabs defaultValue="pos" className="space-y-4">
        <PageHeader
          title={t('staff.sale.title')}
          actions={
            <>
              {ctrl.syncedLines.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={ctrl.handleClear} className="rounded-full">
                  <FilePlus2 className="size-4" />
                  {t('staff.sale.newSale')}
                </Button>
              )}
              {ctrl.lastBill && ctrl.lastBill.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={ctrl.handleRepeatLastBill}
                  className="rounded-full"
                >
                  <RotateCcw className="size-4" />
                  {t('staff.sale.repeatLastBill', { defaultValue: 'Repeat last bill' })}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => ctrl.setLastSalesDrawerOpen(true)}
                className="rounded-full"
              >
                <History className="size-4" />
                {t('staff.sale.lastSalesDrawer', { defaultValue: 'Last sales' })}
              </Button>
              <TabsList>
                <TabsTrigger value="pos">{t('staff.sale.title')}</TabsTrigger>
                <TabsTrigger value="recent">
                  <Receipt className="mr-1.5 size-4" />
                  {t('staff.sale.recentSales')}
                </TabsTrigger>
              </TabsList>
            </>
          }
        />

        <TabsContent value="pos">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
            <QuickSaleCatalogPanel
              search={ctrl.search}
              onSearchChange={ctrl.setSearch}
              category={ctrl.category}
              onCategoryChange={ctrl.setCategory}
              categories={ctrl.categories}
              isLoading={ctrl.catalog.isPending || ctrl.catalog.isLoading}
              isError={ctrl.catalog.isError}
              onRetry={() => void ctrl.catalog.refetch()}
              filtered={ctrl.filtered}
              syncedLines={ctrl.syncedLines}
              onAddQty={ctrl.handleAddQty}
              onToggleAvailable={ctrl.handleToggleAvail}
            />

            <aside className="hidden lg:block">
              <Card className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto p-4">
                <QuickSaleBill
                  lines={ctrl.syncedLines}
                  paymentMethod={ctrl.paymentMethod}
                  onPaymentMethodChange={ctrl.setPaymentMethod}
                  onChangeQuantity={ctrl.handleChangeQty}
                  onOpenKeypad={(item, quantity) => ctrl.setKeypadTarget({ item, quantity })}
                  onRemoveLine={ctrl.handleRemoveLine}
                  onClear={ctrl.handleClear}
                  onSubmit={ctrl.handleSubmit}
                  isSubmitting={ctrl.isSubmitting}
                  errorMessage={ctrl.submitError}
                />
              </Card>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="recent">
          <RecentSalesTab
            onSelectSale={ctrl.setCompletedSale}
            onRepeatSale={ctrl.handleRepeatFromSale}
          />
        </TabsContent>
      </Tabs>

      {ctrl.syncedLines.length > 0 && (
        <div className="bg-card fixed inset-x-0 bottom-14 z-30 border-t p-3 shadow-lg lg:hidden">
          <Button
            size="xl"
            className="flex w-full items-center justify-between rounded-2xl"
            onClick={() => ctrl.setMobileSheetOpen(true)}
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="size-5" />
              {t('staff.sale.itemsCount', { count: ctrl.syncedLines.length })}
            </span>
            <EstimatedAmount
              value={dec(ctrl.estimatedTotal).toFixed(2)}
              className="font-display text-base font-extrabold"
            />
          </Button>
        </div>
      )}

      <Sheet open={ctrl.mobileSheetOpen} onOpenChange={ctrl.setMobileSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('staff.sale.cart')}</SheetTitle>
          </SheetHeader>
          <div className="mt-2 pb-2">
            <QuickSaleBill
              lines={ctrl.syncedLines}
              paymentMethod={ctrl.paymentMethod}
              onPaymentMethodChange={ctrl.setPaymentMethod}
              onChangeQuantity={ctrl.handleChangeQty}
              onOpenKeypad={(item, quantity) => ctrl.setKeypadTarget({ item, quantity })}
              onRemoveLine={ctrl.handleRemoveLine}
              onClear={ctrl.handleClear}
              onSubmit={ctrl.handleSubmit}
              isSubmitting={ctrl.isSubmitting}
              errorMessage={ctrl.submitError}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={ctrl.lastSalesDrawerOpen} onOpenChange={ctrl.setLastSalesDrawerOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('staff.sale.recentSales')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <RecentSalesTab
              onSelectSale={(sale) => {
                ctrl.setLastSalesDrawerOpen(false)
                ctrl.setCompletedSale(sale)
              }}
              onRepeatSale={ctrl.handleRepeatFromSale}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ExactWeightKeypad
        open={Boolean(ctrl.keypadTarget)}
        itemName={ctrl.keypadTarget ? name(ctrl.keypadTarget.item) : ''}
        unitLabel={
          ctrl.keypadTarget
            ? t(`units.${ctrl.keypadTarget.item.baseUnit}`, { defaultValue: ctrl.keypadTarget.item.baseUnit })
            : ''
        }
        initialValue={ctrl.keypadTarget?.quantity ?? ''}
        onOpenChange={(open) => !open && ctrl.setKeypadTarget(null)}
        onConfirm={(nextQty) => {
          if (ctrl.keypadTarget) ctrl.handleChangeQty(ctrl.keypadTarget.item.id, nextQty)
        }}
      />

      <SaleReceiptDialog sale={ctrl.completedSale} onClose={() => ctrl.setCompletedSale(null)} />
    </div>
  )
}
