import { useTranslation } from 'react-i18next'
import { ShoppingBasket } from 'lucide-react'
import { StatusPage } from '@/components/StatusPage'

/**
 * Temporary placeholder for screens scheduled in later phases.
 * Each route file re-exports this until its phase replaces it.
 */
export default function ComingSoonPage() {
  const { t } = useTranslation()
  return (
    <StatusPage
      icon={<ShoppingBasket className="size-10" aria-hidden />}
      title={t('pages.comingSoon')}
      body={t('pages.comingSoonBody')}
      action={<span />}
    />
  )
}
