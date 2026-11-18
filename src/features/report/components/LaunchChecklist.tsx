import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STORAGE_KEY = 'tazatokri-launch-checklist'

const CHECKLIST_ITEMS = [
  { id: 'env-upi', label: 'Verify VITE_SHOP_UPI_ID & Razorpay key env settings' },
  { id: 'pincodes', label: 'Confirm serviceable pincodes on backend config' },
  { id: 'prices', label: 'Replace any sample prices with real mandi rates' },
  { id: 'purchases', label: 'Record opening morning purchases before billing' },
]

function loadChecked(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function LaunchChecklist() {
  const { t } = useTranslation()
  const [checked, setChecked] = useState<Record<string, boolean>>(() => loadChecked())
  const [open, setOpen] = useState(false)

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage quota errors
      }
      return next
    })
  }

  const doneCount = CHECKLIST_ITEMS.filter((i) => checked[i.id]).length

  return (
    <Card className="border-border/90">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <CheckSquare className="text-primary size-4" aria-hidden />
            {t('staff.dashboard.launchChecklist', {
              defaultValue: `Launch checklist (${doneCount}/${CHECKLIST_ITEMS.length})`,
            })}
          </CardTitle>
          <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <Info className="size-3 shrink-0" aria-hidden />
            {t('staff.dashboard.localChecklistNote', {
              defaultValue: 'Local aid only — not proof of backend configuration.',
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('staff.dashboard.toggleChecklist', { defaultValue: 'Toggle checklist' })}
          className="touch-target text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-lg"
        >
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 border-t pt-3">
          {CHECKLIST_ITEMS.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/60"
            >
              <input
                type="checkbox"
                checked={Boolean(checked[item.id])}
                onChange={() => toggle(item.id)}
                className="accent-primary size-4 rounded"
              />
              <span className={checked[item.id] ? 'text-muted-foreground line-through' : ''}>
                {item.label}
              </span>
            </label>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
