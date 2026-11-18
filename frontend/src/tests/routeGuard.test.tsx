import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { RouteGuard } from '@/components/RouteGuard'
import { useAuthStore } from '@/features/auth/store'
import { normalizeRoles } from '@/features/auth/roles'

function LocationProbe() {
  const location = useLocation()
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  )
}

function renderGuardedRoutes(initialEntry: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LocationProbe />} />
          <Route path="/403" element={<div data-testid="forbidden-page">403 Forbidden</div>} />

          <Route element={<RouteGuard requiredRoles={['OWNER', 'STAFF']} />}>
            <Route path="/staff/sale" element={<div data-testid="staff-sale">Quick Sale</div>} />
            <Route element={<RouteGuard requiredRoles={['OWNER']} />}>
              <Route
                path="/staff/dashboard"
                element={<div data-testid="owner-dashboard">Owner Dashboard</div>}
              />
            </Route>
          </Route>

          <Route element={<RouteGuard requiredRoles={['DELIVERY']} />}>
            <Route
              path="/delivery"
              element={<div data-testid="delivery-page">Delivery Portal</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RouteGuard & multi-role access', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('redirects unauthenticated users to /login?next=<encoded-path>', async () => {
    renderGuardedRoutes('/staff/sale?tab=recent')

    const probe = await screen.findByTestId('location-probe')
    expect(probe).toHaveTextContent('/login?next=%2Fstaff%2Fsale%3Ftab%3Drecent')
  })

  it('redirects authenticated user without required role to /403', async () => {
    server.use(
      http.get('*/api/me', () =>
        HttpResponse.json({ phone: '9876543210', roles: ['CUSTOMER'] }),
      ),
    )

    useAuthStore.getState().setUser(
      {
        userId: 10,
        fullName: 'Priya Customer',
        roles: ['CUSTOMER'],
        expiresInMinutes: 60,
      },
      'jwt-customer',
    )

    renderGuardedRoutes('/staff/sale')

    const forbidden = await screen.findByTestId('forbidden-page')
    expect(forbidden).toHaveTextContent('403 Forbidden')
  })

  it('allows multi-role user (OWNER + DELIVERY) to access both /staff/dashboard and /delivery', async () => {
    server.use(
      http.get('*/api/me', () =>
        HttpResponse.json({ phone: '9999999999', roles: ['OWNER', 'DELIVERY'] }),
      ),
    )

    useAuthStore.getState().setUser(
      {
        userId: 1,
        fullName: 'Ramesh Owner-Delivery',
        roles: ['OWNER', 'DELIVERY'],
        expiresInMinutes: 60,
      },
      'jwt-multi',
    )

    const { unmount } = renderGuardedRoutes('/staff/dashboard')
    expect(await screen.findByTestId('owner-dashboard')).toHaveTextContent('Owner Dashboard')
    unmount()

    renderGuardedRoutes('/delivery')
    expect(await screen.findByTestId('delivery-page')).toHaveTextContent('Delivery Portal')
  })

  it('normalizes both array roles and legacy string roles from /api/me', async () => {
    expect(normalizeRoles(['OWNER', 'DELIVERY'])).toEqual(['OWNER', 'DELIVERY'])
    expect(normalizeRoles(['ROLE_STAFF', 'ROLE_DELIVERY'])).toEqual(['STAFF', 'DELIVERY'])
    expect(normalizeRoles('[ROLE_OWNER, ROLE_STAFF]')).toEqual(['OWNER', 'STAFF'])

    server.use(
      http.get('*/api/me', () =>
        HttpResponse.json({ phone: '9999999999', roles: '[ROLE_OWNER, ROLE_DELIVERY]' }),
      ),
    )

    useAuthStore.getState().setUser(
      {
        userId: 1,
        fullName: 'Ramesh',
        roles: ['OWNER'],
        expiresInMinutes: 60,
      },
      'jwt-string-roles',
    )

    renderGuardedRoutes('/staff/dashboard')
    await screen.findByTestId('owner-dashboard')

    await waitFor(() => {
      expect(useAuthStore.getState().user?.roles).toEqual(['OWNER', 'DELIVERY'])
    })
  })
})
