import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toApiError } from '@/lib/api'
import { usePublicStoreSettings } from '@/features/settings/hooks'
import { useCreateAddress } from '../hooks'
import type { CustomerAddress } from '../types'

const addressSchema = z.object({
  label: z.string().trim().min(2, 'Required').max(40),
  line1: z.string().trim().min(4, 'Required').max(150),
  line2: z.string().trim().max(150).optional(),
  landmark: z.string().trim().max(100).optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'addresses.invalidPincode'),
  deliveryInstructions: z.string().trim().max(255).optional(),
})

type AddressForm = z.infer<typeof addressSchema>

interface AddAddressDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (addr: CustomerAddress) => void
}

export function AddAddressDialog({ open, onClose, onCreated }: AddAddressDialogProps) {
  const { t } = useTranslation()
  const createAddr = useCreateAddress()
  const { settings } = usePublicStoreSettings()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: 'Home',
      line1: '',
      line2: '',
      landmark: '',
      pincode: '',
      deliveryInstructions: '',
    },
  })

  const close = () => {
    reset()
    setServerError(null)
    onClose()
  }

  const onSubmit = (values: AddressForm) => {
    setServerError(null)
    const pin = values.pincode.trim()
    if (settings.pincodes.length > 0 && !settings.pincodes.includes(pin)) {
      setServerError(
        t('addresses.unserviceablePincode', {
          pincode: pin,
          pincodes: settings.pincodes.join(', '),
          defaultValue: `We do not deliver to PIN code ${pin} yet. Serviceable PINs: ${settings.pincodes.join(', ')}`,
        }),
      )
      return
    }
    createAddr.mutate(
      {
        label: values.label.trim(),
        line1: values.line1.trim(),
        line2: values.line2?.trim() || undefined,
        landmark: values.landmark?.trim() || undefined,
        pincode: values.pincode.trim(),
        deliveryInstructions: values.deliveryInstructions?.trim() || undefined,
      },
      {
        onSuccess: (addr) => {
          toast.success(t('common.save'))
          onCreated?.(addr)
          close()
        },
        onError: (err) => setServerError(toApiError(err).message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addresses.add')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
          {serverError && (
            <p role="alert" className="bg-tomato-light text-tomato rounded-lg p-3 text-sm">
              {serverError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="addr-label">{t('addresses.label')}</Label>
            <Input id="addr-label" {...register('label')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="addr-line1">{t('addresses.line1')}</Label>
            <Input id="addr-line1" {...register('line1')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="addr-line2">
              {t('addresses.line2')} ({t('common.optional')})
            </Label>
            <Input id="addr-line2" {...register('line2')} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="addr-landmark">
                {t('addresses.landmark')} ({t('common.optional')})
              </Label>
              <Input id="addr-landmark" {...register('landmark')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addr-pin">{t('addresses.pincode')}</Label>
              <Input
                id="addr-pin"
                inputMode="numeric"
                maxLength={6}
                aria-invalid={!!errors.pincode}
                {...register('pincode')}
              />
              {errors.pincode?.message && (
                <p role="alert" className="text-destructive text-xs font-medium">
                  {t(errors.pincode.message, { defaultValue: errors.pincode.message })}
                </p>
              )}
              {settings.pincodes.length > 0 && (
                <p className="text-muted-foreground text-[11px]">
                  {t('addresses.serviceableList', {
                    pincodes: settings.pincodes.join(', '),
                    defaultValue: `Serviceable PINs: ${settings.pincodes.join(', ')}`,
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="addr-instructions">
              {t('addresses.deliveryInstructions', {
                defaultValue: 'Delivery Instructions',
              })}{' '}
              ({t('common.optional')})
            </Label>
            <Input
              id="addr-instructions"
              placeholder={t('addresses.deliveryInstructionsPlaceholder', {
                defaultValue: 'e.g. Ring doorbell once, leave with security guard',
              })}
              {...register('deliveryInstructions')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createAddr.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
