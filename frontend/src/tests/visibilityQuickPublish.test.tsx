import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { deriveProductVisibility } from '@/features/catalog/visibility'
import { VisibilityStatusBlock } from '@/features/catalog/components/VisibilityStatusBadge'
import { QuickPriceDialog } from '@/features/catalog/components/QuickPriceDialog'
import { pricingApi } from '@/features/pricing/api'

describe('deriveProductVisibility', () => {
  it('returns Published when active, stocked, priced, and available today', () => {
    const vis = deriveProductVisibility({
      active: true,
      available: true,
      pricePerUnit: '45.00',
      stock: '12.500',
    })
    expect(vis.code).toBe('PUBLISHED')
    expect(vis.isPublished).toBe(true)
    expect(vis.reasons).toEqual([])
  })

  it('flags stocked item missing selling price', () => {
    const vis = deriveProductVisibility({
      active: true,
      available: true,
      pricePerUnit: null,
      stock: '5',
    })
    expect(vis.code).toBe('HIDDEN_STOCKED')
    expect(vis.missingPrice).toBe(true)
    expect(vis.notAvailableToday).toBe(false)
    expect(vis.reasons).toEqual(['Missing selling price'])
  })

  it('flags stocked item not marked Available Today and both blockers together', () => {
    const notAvail = deriveProductVisibility({
      active: true,
      available: false,
      pricePerUnit: '30',
      stock: '8',
    })
    expect(notAvail.code).toBe('HIDDEN_STOCKED')
    expect(notAvail.reasons).toEqual(['Not marked Available Today'])

    const both = deriveProductVisibility({
      active: true,
      available: false,
      pricePerUnit: null,
      stock: '8',
    })
    expect(both.code).toBe('HIDDEN_STOCKED')
    expect(both.reasons).toEqual(['Missing selling price', 'Not marked Available Today'])
  })

  it('flags out-of-stock and inactive items without marking them publishable', () => {
    const out = deriveProductVisibility({
      active: true,
      available: false,
      pricePerUnit: '30',
      stock: '0',
    })
    expect(out.code).toBe('OUT_OF_STOCK')
    expect(out.hasStock).toBe(false)

    const inactive = deriveProductVisibility({
      active: false,
      available: true,
      pricePerUnit: '30',
      stock: '10',
    })
    expect(inactive.code).toBe('INACTIVE')
    expect(inactive.isPublished).toBe(false)
  })
})

describe('VisibilityStatusBlock & QuickPriceDialog quick actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders quick actions for stocked hidden items and hides Enable Available Today when out of stock', async () => {
    const user = userEvent.setup()
    const onPrice = vi.fn()
    const onEnable = vi.fn()

    const hiddenVis = deriveProductVisibility({
      active: true,
      available: false,
      pricePerUnit: null,
      stock: '5',
    })

    const { rerender } = render(
      <MemoryRouter>
        <VisibilityStatusBlock
          visibility={hiddenVis}
          editTo="/staff/catalog/1"
          onQuickPrice={onPrice}
          onQuickEnableAvailable={onEnable}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Stock available, hidden')).toBeInTheDocument()
    expect(screen.getByText('Missing selling price')).toBeInTheDocument()
    expect(screen.getByText('Not marked Available Today')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /set price/i }))
    await user.click(screen.getByRole('button', { name: /enable available today/i }))
    expect(onPrice).toHaveBeenCalledTimes(1)
    expect(onEnable).toHaveBeenCalledTimes(1)

    const outVis = deriveProductVisibility({
      active: true,
      available: false,
      pricePerUnit: '40',
      stock: '0',
    })

    rerender(
      <MemoryRouter>
        <VisibilityStatusBlock
          visibility={outVis}
          editTo="/staff/catalog/1"
          onQuickPrice={onPrice}
          onQuickEnableAvailable={onEnable}
        />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: /enable available today/i })).not.toBeInTheDocument()
  })

  it('validates positive price and submits via pricingApi.setPrice', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(pricingApi, 'setPrice').mockResolvedValue({
      vegetableId: 7,
      nameEn: 'Tomato',
      baseUnit: 'KG',
      pricePerUnit: '42.00',
      effectiveDate: '2026-11-21',
    } as never)
    const onClose = vi.fn()
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })

    render(
      <QueryClientProvider client={qc}>
        <QuickPriceDialog
          target={{ id: 7, name: 'Tomato', baseUnit: 'KG', currentPrice: null }}
          onClose={onClose}
        />
      </QueryClientProvider>,
    )

    const input = screen.getByRole('spinbutton')
    await user.type(input, '0')
    await user.click(screen.getByRole('button', { name: /save price/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/greater than 0/i)
    expect(spy).not.toHaveBeenCalled()

    await user.clear(input)
    await user.type(input, '42')
    await user.click(screen.getByRole('button', { name: /save price/i }))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(7, { pricePerUnit: '42.00' })
      expect(onClose).toHaveBeenCalled()
    })
  })
})
