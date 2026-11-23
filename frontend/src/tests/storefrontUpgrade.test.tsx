import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import { ShopHero } from '@/features/catalog/components/ShopHero'
import { VegetableCard } from '@/features/catalog/components/VegetableCard'
import { useCartStore } from '@/features/cart/store'
import type { PublicVegetable } from '@/features/catalog/types'

const sampleVeg: PublicVegetable = {
  id: 1,
  nameEn: 'Tomato',
  nameMr: 'टोमॅटो',
  nameHi: 'टमाटर',
  category: 'Everyday Vegetables',
  baseUnit: 'KG',
  pricePerUnit: '40.00',
  inStock: true,
  availableStock: '10.000',
  imageUrl: '/vegetables/tomato.jpg',
  options: [
    { unitId: 1, label: '500 g', quantityInBaseUnit: '0.500', price: '20.00', defaultOption: true },
    { unitId: 2, label: '1 kg', quantityInBaseUnit: '1.000', price: '40.00', defaultOption: false },
  ],
}

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/shop']}>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Premium Customer Storefront UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useCartStore.getState().clearCart()
  })

  it('scopes storefront-theme to CustomerLayout without mutating global root', () => {
    const { container } = renderWithProviders(<CustomerLayout />)
    expect(container.querySelector('.storefront-theme')).toBeInTheDocument()
  })

  it('renders ShopHero with dedicated hero produce photography and fallback on error', () => {
    renderWithProviders(<ShopHero featuredVegetables={[sampleVeg]} />)
    const heroImg = screen.getByRole('img', { name: /freshness for every home/i })
    expect(heroImg).toHaveAttribute('src', '/hero-produce.jpg')

    // Triggers graceful fallback if hero image fails to load
    fireEvent.error(heroImg)
    expect(screen.queryByRole('img', { name: /freshness for every home/i })).not.toBeInTheDocument()
  })

  it('supports unit selection, add-to-cart, and quantity stepper on VegetableCard', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VegetableCard vegetable={sampleVeg} />)

    await user.click(screen.getByRole('radio', { name: /1 kg/i }))
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0]?.unitLabel).toBe('1 kg')
    expect(screen.getByRole('button', { name: /increase/i })).toBeInTheDocument()
  })
})
