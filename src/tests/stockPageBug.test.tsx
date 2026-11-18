import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import i18n from '@/i18n'
import { useAuthStore } from '@/features/auth/store'
import type { StaffCatalogItem } from '@/features/catalog/types'
import StockPage from '@/features/inventory/pages/StockPage'

const stockFixture: StaffCatalogItem[] = [
  {
    id: 1,
    nameEn: 'Tomato',
    nameMr: 'टोमॅटो',
    nameHi: 'टमाटर',
    category: 'Everyday Vegetables',
    baseUnit: 'KG',
    pricePerUnit: '40.00',
    stock: '24.000',
    available: true,
    options: [],
  },
  {
    id: 2,
    nameEn: 'Spinach (Palak)',
    nameMr: 'पालक',
    nameHi: 'पालक',
    category: 'Leafy Greens',
    baseUnit: 'BUNCH',
    pricePerUnit: '20.00',
    stock: '4.000',
    available: true,
    options: [],
  },
  {
    id: 3,
    nameEn: 'Okra (Bhendi)',
    nameMr: 'भेंडी',
    nameHi: 'भिंडी',
    category: 'Everyday Vegetables',
    baseUnit: 'KG',
    pricePerUnit: '60.00',
    stock: '0.000',
    available: false,
    options: [],
  },
]

function renderStockPage(qc?: QueryClient) {
  const client =
    qc ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/staff/stock']}>
        <StockPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Phase 1 Regression — StockPage loading, empty & filter states', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    onlineManager.setOnline(true)
    useAuthStore.getState().setUser(
      { userId: 1, fullName: 'Owner', roles: ['OWNER'] },
      'test-token',
    )
  })

  it('does NOT render "No results found" while query is pending & paused (offline)', () => {
    onlineManager.setOnline(false)
    server.use(http.get('*/api/staff/catalog', () => HttpResponse.json(stockFixture)))

    renderStockPage()

    expect(screen.queryByText('No results found')).not.toBeInTheDocument()
    onlineManager.setOnline(true)
  })

  it('distinguishes genuinely empty stock catalog from "No results found" search mismatch', async () => {
    server.use(http.get('*/api/staff/catalog', () => HttpResponse.json([])))

    renderStockPage()

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
    expect(screen.queryByText('No results found')).not.toBeInTheDocument()
  })

  it('displays all stock records on All filter and supports Low, Out, Available, Search, Sort, and Error retry', async () => {
    server.use(http.get('*/api/staff/catalog', () => HttpResponse.json(stockFixture)))

    renderStockPage()

    await waitFor(() => expect(screen.getByText('Tomato')).toBeInTheDocument())
    expect(screen.getByText('Spinach (Palak)')).toBeInTheDocument()
    expect(screen.getByText('Okra (Bhendi)')).toBeInTheDocument()

    // Low stock filter -> Spinach only
    fireEvent.click(screen.getByRole('button', { name: 'Low stock' }))
    expect(screen.getByText('Spinach (Palak)')).toBeInTheDocument()
    expect(screen.queryByText('Tomato')).not.toBeInTheDocument()
    expect(screen.queryByText('Okra (Bhendi)')).not.toBeInTheDocument()

    // Out of stock filter -> Okra only
    fireEvent.click(screen.getByRole('button', { name: 'Out of stock' }))
    expect(screen.getByText('Okra (Bhendi)')).toBeInTheDocument()
    expect(screen.queryByText('Tomato')).not.toBeInTheDocument()

    // Available today -> Tomato + Spinach
    fireEvent.click(screen.getByRole('button', { name: 'Available today' }))
    expect(screen.getByText('Tomato')).toBeInTheDocument()
    expect(screen.getByText('Spinach (Palak)')).toBeInTheDocument()
    expect(screen.queryByText('Okra (Bhendi)')).not.toBeInTheDocument()

    // Back to All + Search -> mismatch shows "No results found"
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    const searchInput = screen.getByLabelText('Search stock...')
    fireEvent.change(searchInput, { target: { value: 'bhindi' } })
    expect(screen.getByText('Okra (Bhendi)')).toBeInTheDocument()
    expect(screen.queryByText('Tomato')).not.toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'zzzzz' } })
    expect(screen.getByText('No results found')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: '' } })
    const headingsBefore = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headingsBefore).toEqual(['Okra (Bhendi)', 'Spinach (Palak)', 'Tomato'])

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'stockAsc' } })
    const headingsAfter = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headingsAfter).toEqual(['Okra (Bhendi)', 'Spinach (Palak)', 'Tomato'])
  })

  it('renders error state when /api/staff/catalog fails', async () => {
    server.use(
      http.get('*/api/staff/catalog', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    )

    renderStockPage()

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument()
    })
  })
})
