import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { authApi } from './api'
import { normalizeRoles, postLoginPath } from './roles'
import { useAuthStore } from './store'
import type { LoginRequest, SignupRequest } from './types'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

/** Log in, store the session, and navigate to `next` or the role's home. */
export function useLogin(next?: string | null) {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (res) => {
      const roles = normalizeRoles(res.roles)
      qc.clear() // never show the previous user's cached data
      setUser(
        {
          userId: res.userId,
          fullName: res.fullName,
          roles,
          expiresInMinutes: res.expiresInMinutes,
        },
        res.token,
      )
      toast.success(t('auth.loginSuccess'))
      navigate(postLoginPath(roles, next), { replace: true })
    },
  })
}

export function useSignup() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: SignupRequest) => authApi.signup(data),
    onSuccess: (_res, vars) => {
      toast.success(t('auth.signupSuccess'))
      navigate(`/login?phone=${encodeURIComponent(vars.phone)}`, { replace: true })
    },
  })
}

/**
 * Session restore: when a persisted session exists, validate it with /api/me
 * and refresh roles. A 401 is handled globally (logout + redirect).
 */
export function useMe() {
  const user = useAuthStore((s) => s.user)
  const syncFromMe = useAuthStore((s) => s.syncFromMe)
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token')

  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: () => authApi.me(),
    enabled: !!user || hasToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  useEffect(() => {
    if (query.data) {
      const roles = normalizeRoles(query.data.roles)
      if (roles.length > 0) {
        syncFromMe({
          roles,
          phone: query.data.phone,
          userId: query.data.userId,
          fullName: query.data.fullName,
        })
      }
    }
  }, [query.data, syncFromMe])

  return query
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation()

  return () => {
    logout()
    qc.clear()
    navigate('/login', { replace: true })
    toast.info(t('auth.loggedOut'))
  }
}
