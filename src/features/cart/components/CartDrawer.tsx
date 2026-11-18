import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CartContents } from './CartContents'

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCheckout: () => void
  prunedNames?: string[]
  onDismissPruned?: () => void
}

export function CartDrawer({
  open,
  onOpenChange,
  onCheckout,
  prunedNames,
  onDismissPruned,
}: CartDrawerProps) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="font-organic">{t('cart.title')}</SheetTitle>
        </SheetHeader>
        <CartContents
          onCheckout={onCheckout}
          prunedNames={prunedNames}
          onDismissPruned={onDismissPruned}
          compactListClassName="max-h-64"
        />
      </SheetContent>
    </Sheet>
  )
}
