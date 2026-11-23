import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CartContents } from './CartContents'

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCheckout: () => void
  onSaveAsBasket?: () => void
  prunedNames?: string[]
  onDismissPruned?: () => void
}

export function CartDrawer({
  open,
  onOpenChange,
  onCheckout,
  onSaveAsBasket,
  prunedNames,
  onDismissPruned,
}: CartDrawerProps) {
  const { t } = useTranslation()
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={isDesktop ? 'w-full max-w-md overflow-y-auto p-6' : 'max-h-[85vh] overflow-y-auto'}
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="font-organic text-2xl font-normal">{t('cart.title')}</SheetTitle>
        </SheetHeader>
        <CartContents
          onCheckout={onCheckout}
          onSaveAsBasket={onSaveAsBasket}
          prunedNames={prunedNames}
          onDismissPruned={onDismissPruned}
          compactListClassName={isDesktop ? 'max-h-[55vh]' : 'max-h-64'}
        />
      </SheetContent>
    </Sheet>
  )
}
