import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CatalogImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onConfirm: () => void
}

export function CatalogImportDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: CatalogImportDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import 36 Default Vegetables</DialogTitle>
          <DialogDescription>
            This creates the 3 categories, 36 vegetable names (English, Marathi &amp; Hindi), base
            units, and selling sizes. It never creates stock, prices, or ledger entries. Set real
            selling prices on the Pricing page afterwards.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button type="button" loading={isPending} onClick={onConfirm}>
            Confirm Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
