import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import SignupPage from '@/features/auth/pages/SignupPage'
import { useAuthStore } from '@/features/auth/store'
import { api } from '@/lib/api'

function renderWithRouter(ui: React.ReactNode, initialPath = '/signup') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/signup" element={ui} />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          <Route path="/shop" element={<div data-testid="shop-page">Shop</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Stage 5 Account & Security QA (Frontend)', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null, activeRole: null, isHydrated: true })
  })

  it('validates registration fields client-side and surfaces duplicate account 409 error safely', async () => {
    let signupCalls = 0
    server.use(
      http.post('*/api/auth/signup', async () => {
        signupCalls += 1
        return HttpResponse.json({ message: 'Phone already registered' }, { status: 409 })
      }),
    )

    const user = userEvent.setup()
    renderWithRouter(<SignupPage />)

    // Whitespace name + invalid phone + short password should fail client-side without hitting API
    await user.type(screen.getByLabelText(/Full name/i), '   ')
    await user.type(screen.getByLabelText(/Phone/i), '12345')
    await user.type(screen.getByLabelText(/^Password$/i), 'short')
    await user.type(screen.getByLabelText(/Confirm password/i), 'mismatch')
    await user.click(screen.getByRole('button', { name: /^Sign up$/i }))

    expect(signupCalls).toBe(0)

    // Valid inputs hit API and display 409 conflict safely
    await user.clear(screen.getByLabelText(/Full name/i))
    await user.type(screen.getByLabelText(/Full name/i), '  Asha Patil  ')
    await user.clear(screen.getByLabelText(/Phone/i))
    await user.type(screen.getByLabelText(/Phone/i), '9876543210')
    await user.clear(screen.getByLabelText(/^Password$/i))
    await user.type(screen.getByLabelText(/^Password$/i), 'SecurePass123')
    await user.clear(screen.getByLabelText(/Confirm password/i))
    await user.type(screen.getByLabelText(/Confirm password/i), 'SecurePass123')
    await user.click(screen.getByRole('button', { name: /^Sign up$/i }))

    expect(await screen.findByText(/Phone already registered/i)).toBeInTheDocument()
    expect(signupCalls).toBe(1)
  })

  it('stores JWT outside tazatokri-auth, clears session on logout, and dispatches auth:unauthorized only for protected 401s', async () => {
    useAuthStore.getState().setUser(
      {
        userId: 10,
        fullName: 'Asha Patil',
        phone: '9876543210',
        roles: ['CUSTOMER'],
        expiresInMinutes: 60,
      },
      'jwt.header.payload',
    )

    // Token is stored in localStorage['token'], never inside localStorage['tazatokri-auth']
    expect(localStorage.getItem('token')).toBe('jwt.header.payload')
    const persistedAuth = localStorage.getItem('tazatokri-auth') ?? ''
    expect(persistedAuth).not.toContain('jwt.header.payload')

    // Protected 401 dispatches auth:unauthorized; public 401 does NOT
    const listener = vi.fn()
    window.addEventListener('auth:unauthorized', listener)

    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ message: 'Invalid phone or password' }, { status: 401 }),
      ),
      http.get('*/api/account/profile', () =>
        HttpResponse.json({ message: 'Authentication required' }, { status: 401 }),
      ),
    )

    await expect(
      api.post('/api/auth/login', { phone: '9876543210', password: 'wrong' }, { public: true }),
    ).rejects.toThrow()
    expect(listener).not.toHaveBeenCalled()

    await expect(api.get('/api/account/profile')).rejects.toThrow()
    await waitFor(() => {
      expect(listener).toHaveBeenCalledTimes(1)
    })

    window.removeEventListener('auth:unauthorized', listener)

    // Logout clears token and store state
    useAuthStore.getState().logout()
    expect(localStorage.getItem('token')).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().activeRole).toBeNull()
  })
})
