import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface AttentionItem {
  id: string
  label: string
  countLabel: string
  to: string
  tone: 'warning' | 'destructive' | 'secondary'
}

export function NeedsAttentionCard({ items }: { items: AttentionItem[] }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="text-turmeric size-4" aria-hidden />
          {t('staff.dashboard.needsAttention', { defaultValue: 'Needs attention' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-primary flex items-center gap-2 rounded-xl bg-secondary/50 p-3 text-xs font-semibold">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            <span>
              {t('staff.dashboard.allClear', {
                defaultValue: 'Everything looks on track right now.',
              })}
            </span>
          </div>
        ) : (
          <ul className="divide-border divide-y rounded-xl border">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className="hover:bg-muted/50 flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-sm transition-colors"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <Badge variant={item.tone}>{item.countLabel}</Badge>
                    <ArrowRight className="text-muted-foreground size-3.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
