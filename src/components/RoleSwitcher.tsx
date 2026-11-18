import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ShoppingBag, Store, Truck } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store'
import { ROLE_HOME } from '@/features/auth/roles'
import type { Role } from '@/features/auth/types'
import { cn } from '@/lib/utils'

const ROLE_ICONS: Record<Role, ReactNode> = {
  OWNER: <ShieldCheck className="size-3.5 shrink-0" aria-hidden />,
  STAFF: <Store className="size-3.5 shrink-0" aria-hidden />,
  DELIVERY: <Truck className="size-3.5 shrink-0" aria-hidden />,
  CUSTOMER: <ShoppingBag className="size-3.5 shrink-0" aria-hidden />,
}

/** Header chips for users holding several roles (e.g. OWNER + DELIVERY). */
export function RoleSwitcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const activeRole = useAuthStore((s) => s.activeRole)
  const setActiveRole = useAuthStore((s) => s.setActiveRole)

  if (!user || user.roles.length <= 1) return null

  const handleSwitch = (role: Role) => {
    setActiveRole(role)
    navigate(ROLE_HOME[role])
  }

  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label={t('common.roles', { defaultValue: 'Roles' })}
    >
      {user.roles.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => handleSwitch(role)}
          aria-pressed={activeRole === role}
          title={t(`roles.${role}`)}
          className={cn(
            'touch-target flex items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors',
            activeRole === role
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-secondary hover:text-primary',
          )}
        >
          {ROLE_ICONS[role]}
          <span className="sr-only sm:not-sr-only">{t(`roles.${role}`)}</span>
        </button>
      ))}
    </div>
  )
}
