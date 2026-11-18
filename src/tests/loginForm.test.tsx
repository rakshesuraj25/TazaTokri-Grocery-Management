import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import LoginPage from '@/features/auth/pages/LoginPage'
import { useAuthStore } from '@/features/auth/store'

function renderLoginPage(initialEntry = '/login') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/staff/sale" element={<div data-testid="staff-sale">Quick Sale</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage validation & server error display', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('shows client-side validation errors for invalid phone and short password without calling API', async () => {
    let apiCalled = false
    server.use(
      http.post('*/api/auth/login', () => {
        apiCalled = true
        return HttpResponse.json({ message: 'Should not be called' }, { status: 400 })
      }),
    )

    const user = userEvent.setup()
    renderLoginPage()

    const phoneInput = screen.getByLabelText(/phone number/i) as HTMLInputElement
    expect(phoneInput).toHaveAttribute('placeholder', '10-digit mobile number')
    expect(phoneInput.value).toBe('')

    await user.type(phoneInput, '12345')
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    const alerts = await screen.findAllByRole('alert')
    const messages = alerts.map((a) => a.textContent)
    expect(messages).toContain('Enter a valid 10-digit mobile number')
    expect(messages).toContain('Password must be 8-64 characters')
    expect(apiCalled).toBe(false)
  })

  it('displays server 401 error message when login fails', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ message: 'Invalid Phone or password' }, { status: 401 }),
      ),
    )

    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText(/phone number/i), '9876543210')
    await user.type(screen.getByLabelText(/^password$/i), 'WrongPass123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Invalid Phone or password')
  })
})
