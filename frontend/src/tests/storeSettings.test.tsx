import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import StoreSettingsPage from '@/features/settings/pages/StoreSettingsPage'
import { storeSettingsApi } from '@/features/settings/api'

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <StoreSettingsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('StoreSettingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(storeSettingsApi, 'get').mockResolvedValue({
      pincodes: ['411026', '411039'],
      minOrder: 150,
      deliveryFee: 30,
      freeDeliveryAbove: 300,
      cutoffTime: '18:00',
      storeOpen: true,
    })
  })

  it('validates PIN format, prevents duplicates, and confirms PIN removal', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText('411026')).toBeInTheDocument())

    const pinInput = screen.getByLabelText(/add 6-digit pin code/i)
    await user.type(pinInput, '4110')
    await user.click(screen.getByRole('button', { name: /add pin/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/valid 6-digit indian pin/i)

    await user.clear(pinInput)
    await user.type(pinInput, '411026')
    await user.click(screen.getByRole('button', { name: /add pin/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/already in the serviceable list/i)

    await user.clear(pinInput)
    await user.type(pinInput, '411057')
    await user.click(screen.getByRole('button', { name: /add pin/i }))
    expect(screen.getByText('411057')).toBeInTheDocument()

    // Confirm before removing a PIN
    await user.click(screen.getByRole('button', { name: /remove pin 411039/i }))
    expect(screen.getByText(/remove pin code 411039\?/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^remove pin$/i }))
    await waitFor(() => expect(screen.queryByText('411039')).not.toBeInTheDocument())
  })

  it('validates negative delivery fee and saves valid settings', async () => {
    const user = userEvent.setup()
    const updateSpy = vi.spyOn(storeSettingsApi, 'update').mockResolvedValue({
      pincodes: ['411026', '411039'],
      minOrder: 200,
      deliveryFee: 25,
      freeDeliveryAbove: 400,
      cutoffTime: '19:00',
      storeOpen: true,
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('411026')).toBeInTheDocument())

    const feeInput = screen.getByLabelText(/delivery fee/i)
    await user.clear(feeInput)
    await user.type(feeInput, '-10')
    await user.click(screen.getByRole('button', { name: /save settings/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/delivery fee must be/i)
    expect(updateSpy).not.toHaveBeenCalled()

    await user.clear(feeInput)
    await user.type(feeInput, '25')
    const minInput = screen.getByLabelText(/minimum order amount/i)
    await user.clear(minInput)
    await user.type(minInput, '200')
    await user.click(screen.getByRole('button', { name: /save settings/i }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        pincodes: ['411026', '411039'],
        minOrder: 200,
        deliveryFee: 25,
        freeDeliveryAbove: 300,
        cutoffTime: '18:00',
        storeOpen: true,
      })
      expect(screen.getByRole('status')).toHaveTextContent(/store settings saved/i)
    })
  })
})
