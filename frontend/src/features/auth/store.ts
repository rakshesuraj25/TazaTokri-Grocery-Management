/**
 * Auth Zustand store.
 * Raw JWT is stored ONLY under localStorage['token'] (read by lib/api.ts);
 * only non-secret user metadata + activeRole are persisted in localStorage['tazatokri-auth'].
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultRole } from './roles'
import type { AuthUser, Role } from './types'

interface AuthState {
  user: AuthUser | null
  activeRole: Role | null
  isHydrated: boolean

  setUser: (user: AuthUser, token?: string) => void
  setRoles: (roles: Role[]) => void
  syncFromMe: (me: { roles: Role[]; phone?: string; userId?: number; fullName?: string }) => void
  setActiveRole: (role: Role) => void
  logout: () => void
  hydrate: () => void
}

function stripToken(user: AuthUser & { token?: unknown }): AuthUser {
  const { token: _removed, ...clean } = user
  void _removed
  return clean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      activeRole: null,
      isHydrated: false,

      setUser: (user, token) => {
        if (token) {
          localStorage.setItem('token', token)
        }
        const expiresAt =
          user.expiresAt ??
          (user.expiresInMinutes !== undefined
            ? Date.now() + user.expiresInMinutes * 60_000
            : undefined)
        const cleanUser = stripToken({ ...user, expiresAt })
        set({ user: cleanUser, activeRole: defaultRole(cleanUser.roles) })
      },

      /** Refresh roles from /api/me without touching the token. */
      setRoles: (roles) => {
        get().syncFromMe({ roles })
      },

      /** Hydrate or update user metadata from /api/me even when userId/fullName are absent. */
      syncFromMe: ({ roles, phone, userId, fullName }) => {
        if (roles.length === 0) return
        const { user, activeRole } = get()
        const keep = activeRole && roles.includes(activeRole) ? activeRole : defaultRole(roles)
        const nextUser: AuthUser = {
          ...(user ? stripToken(user) : {}),
          roles,
          ...(phone !== undefined ? { phone } : {}),
          ...(userId !== undefined ? { userId } : {}),
          ...(fullName !== undefined ? { fullName } : {}),
        }
        set({ user: nextUser, activeRole: keep })
      },

      setActiveRole: (role) => {
        const { user } = get()
        if (user?.roles.includes(role)) set({ activeRole: role })
      },

      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, activeRole: null })
      },

      hydrate: () => set({ isHydrated: true }),
    }),
    {
      name: 'tazatokri-auth',
      partialize: (state) => ({
        user: state.user ? stripToken(state.user) : null,
        activeRole: state.activeRole,
      }),
      onRehydrateStorage: () => (state) => {
        // Strip any legacy token previously persisted inside tazatokri-auth and verify session.
        if (state?.user) {
          const clean = stripToken(state.user as AuthUser & { token?: unknown })
          const token = localStorage.getItem('token')
          const expired = clean.expiresAt !== undefined && clean.expiresAt < Date.now()
          if (!token || expired) {
            state.logout()
          } else {
            state.user = clean
          }
        }
        state?.hydrate()
      },
    },
  ),
)

export const selectUser = (s: AuthState) => s.user
export const selectRoles = (s: AuthState) => s.user?.roles ?? []
export const selectActiveRole = (s: AuthState) => s.activeRole
export const selectIsAuthenticated = (s: AuthState) => !!s.user
