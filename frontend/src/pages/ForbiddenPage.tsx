import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import { StatusPage } from '@/components/StatusPage'

export default function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <StatusPage
      icon={<ShieldAlert className="text-tomato size-10" aria-hidden />}
      title={t('pages.forbiddenTitle')}
      body={t('pages.forbiddenBody')}
    />
  )
}
