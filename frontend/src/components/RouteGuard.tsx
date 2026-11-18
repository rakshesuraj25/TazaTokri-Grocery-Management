import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/features/auth/store'
import { useMe } from '@/features/auth/hooks'
import type { Role } from '@/features/auth/types'

interface RouteGuardProps {
  requiredRoles?: Role[]
  redirectTo?: string
}

/**
 * UX-only route guard (the server enforces permissions).
 * Also triggers /api/me once per session to validate the token and refresh roles.
 */
export function RouteGuard({ requiredRoles, redirectTo = '/login' }: RouteGuardProps) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  useMe()

  useEffect(() => {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search)
      navigate(`${redirectTo}?next=${next}`, { replace: true })
      return
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((r) => user.roles.includes(r))
      if (!hasRole) navigate('/403', { replace: true })
    }
  }, [user, requiredRoles, redirectTo, navigate, location.pathname, location.search])

  if (!user) return null
  if (requiredRoles && !requiredRoles.some((r) => user.roles.includes(r))) return null

  return <Outlet />
}
