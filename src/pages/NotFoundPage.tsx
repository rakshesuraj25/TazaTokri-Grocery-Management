import { useTranslation } from 'react-i18next'
import { FileQuestion } from 'lucide-react'
import { StatusPage } from '@/components/StatusPage'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <StatusPage
      icon={<FileQuestion className="size-10" aria-hidden />}
      title={t('pages.notFoundTitle')}
      body={t('pages.notFoundBody')}
    />
  )
}
