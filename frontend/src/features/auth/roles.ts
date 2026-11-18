import type { Role } from './types'

export const ALL_ROLES: Role[] = ['OWNER', 'STAFF', 'DELIVERY', 'CUSTOMER']

/** Preference order used to pick the default active role after login. */
const PRIORITY: Role[] = ['OWNER', 'STAFF', 'DELIVERY', 'CUSTOMER']

export const ROLE_HOME: Record<Role, string> = {
  OWNER: '/staff/dashboard',
  STAFF: '/staff/sale',
  DELIVERY: '/delivery',
  CUSTOMER: '/shop',
}

/** Which role "owns" a path — used to keep activeRole in sync with the URL. */
export function areaForPath(path: string): Role[] {
  if (path.startsWith('/staff')) return ['OWNER', 'STAFF']
  if (path.startsWith('/delivery')) return ['DELIVERY']
  if (path.startsWith('/shop')) return ['CUSTOMER']
  return []
}

/**
 * Parse roles defensively: the backend may send an array, a single string,
 * a bracketed string like "[ROLE_STAFF, ROLE_DELIVERY]", or Spring-style "ROLE_OWNER".
 */
export function normalizeRoles(raw: unknown): Role[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[\s,[\]"']+/)
      : []
  const roles = list
    .map((r) =>
      String(r)
        .trim()
        .replace(/^\[+|\]+$/g, '')
        .toUpperCase()
        .replace(/^ROLE_/, ''),
    )
    .filter((r): r is Role => (ALL_ROLES as string[]).includes(r))
  return Array.from(new Set(roles))
}

export function defaultRole(roles: Role[]): Role | null {
  return PRIORITY.find((r) => roles.includes(r)) ?? null
}

/**
 * Where to go after login: a safe in-app `next` path the user may access,
 * otherwise the home of their default role.
 */
export function postLoginPath(roles: Role[], next?: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')) {
    const area = areaForPath(next)
    if (area.length === 0 || area.some((r) => roles.includes(r))) return next
  }
  const role = defaultRole(roles)
  return role ? ROLE_HOME[role] : '/shop'
}
