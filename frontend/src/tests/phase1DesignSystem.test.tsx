import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, screen, fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n'
import { Logo, LogoMark } from '@/components/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { StatusBadge } from '@/components/StatusBadge'
import { StockMeter } from '@/components/StockMeter'
import { PriceTag } from '@/components/PriceTag'
import { SectionHeader } from '@/components/SectionHeader'
import { Stat } from '@/components/Stat'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import {
  CardSkeleton,
  ListSkeleton,
  ProductGridSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/Skeletons'
import { VegetablePlaceholder } from '@/components/VegetablePlaceholder'
import { resolveCategoryTone } from '@/lib/categoryTheme'
import StyleGuidePage from '@/pages/StyleGuidePage'

function renderWithProviders(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('Phase 1 Design System components', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('renders LogoMark SVG and Logo with TazaTokri and ताजा टोकरी wordmarks', () => {
    renderWithProviders(
      <div>
        <LogoMark size="md" />
        <Logo size="lg" showDevanagari />
      </div>,
    )

    expect(screen.getAllByTestId('tazatokri-logo-mark').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByTestId('tazatokri-logo')).toHaveTextContent('TazaTokri')
    expect(screen.getByTestId('tazatokri-logo')).toHaveTextContent('ताजा टोकरी')
  })

  it('LanguageSwitcher renders EN | मराठी | हिंदी segmented control and switches i18n language', async () => {
    renderWithProviders(<LanguageSwitcher />)

    const group = screen.getByTestId('language-switcher')
    expect(group).toHaveAttribute('role', 'radiogroup')

    const enBtn = screen.getByRole('radio', { name: 'English' })
    const mrBtn = screen.getByRole('radio', { name: 'मराठी (Marathi)' })
    const hiBtn = screen.getByRole('radio', { name: 'हिंदी (Hindi)' })

    expect(enBtn).toHaveTextContent('EN')
    expect(mrBtn).toHaveTextContent('मराठी')
    expect(hiBtn).toHaveTextContent('हिंदी')
    expect(enBtn).toHaveAttribute('aria-checked', 'true')

    await act(async () => {
      fireEvent.click(mrBtn)
    })
    expect(i18n.language).toBe('mr')
    expect(mrBtn).toHaveAttribute('aria-checked', 'true')

    await act(async () => {
      fireEvent.click(hiBtn)
    })
    expect(i18n.language).toBe('hi')
    expect(hiBtn).toHaveAttribute('aria-checked', 'true')
  })

  it('maps Leafy Greens, Everyday Vegetables, Roots & Tubers, and unknown categories cleanly', () => {
    expect(resolveCategoryTone('Leafy Greens')).toBe('leafy')
    expect(resolveCategoryTone('Everyday Vegetables')).toBe('everyday')
    expect(resolveCategoryTone('Roots & Tubers')).toBe('roots')
    expect(resolveCategoryTone('Roots and Tubers')).toBe('roots')
    expect(resolveCategoryTone('Seasonal')).toBe('neutral')
    expect(resolveCategoryTone(null)).toBe('neutral')

    const { rerender } = renderWithProviders(
      <VegetablePlaceholder category="Leafy Greens" label="Spinach" />,
    )
    expect(screen.getByTestId('vegetable-image-placeholder')).toHaveAttribute(
      'data-category-tone',
      'leafy',
    )
    expect(screen.getByTestId('vegetable-image-placeholder').querySelector('[data-illustration="leafy"]')).not.toBeNull()

    rerender(<VegetablePlaceholder category="Roots & Tubers" label="Potato" />)
    expect(screen.getByTestId('vegetable-image-placeholder')).toHaveAttribute(
      'data-category-tone',
      'roots',
    )
    expect(screen.getByTestId('vegetable-image-placeholder').querySelector('[data-illustration="roots"]')).not.toBeNull()
  })

  it('renders StatusBadge across stock, price, and order domains in en, mr, and hi', async () => {
    renderWithProviders(
      <div>
        <StatusBadge kind="stock" status="IN_STOCK" />
        <StatusBadge kind="stock" status="LOW_STOCK" />
        <StatusBadge kind="stock" status="OUT_OF_STOCK" />
        <StatusBadge kind="price" status="SET" />
        <StatusBadge kind="price" status="NOT_SET" />
        <StatusBadge kind="price" status="STALE" />
        <StatusBadge kind="order" status="DELIVERED" />
      </div>,
    )

    expect(screen.getByText('Low stock')).toBeInTheDocument()
    expect(screen.getByText('Price not set')).toBeInTheDocument()
    expect(screen.getByText('Delivered')).toBeInTheDocument()

    await act(async () => {
      await i18n.changeLanguage('mr')
    })
    expect(screen.getByText('कमी साठा')).toBeInTheDocument()
    expect(screen.getByText('दर ठरवलेला नाही')).toBeInTheDocument()

    await act(async () => {
      await i18n.changeLanguage('hi')
    })
    expect(screen.getByText('कम स्टॉक')).toBeInTheDocument()
    expect(screen.getByText('कीमत तय नहीं')).toBeInTheDocument()
  })

  it('renders StockMeter, PriceTag, SectionHeader, Stat, EmptyState, ErrorState, and Skeletons', () => {
    const onRetry = vi.fn()
    const onNextStep = vi.fn()

    renderWithProviders(
      <div>
        <StockMeter quantity="3" max={25} unitLabel="kg" />
        <PriceTag price="45.00" unitLabel="kg" />
        <PriceTag price={null} />
        <SectionHeader title="Roots & Tubers" category="Roots & Tubers" count={10} />
        <Stat label="Revenue" value="₹4,500" hint="Today" tone="positive" />
        <EmptyState title="Empty" actionLabel="Browse Shop" onAction={onNextStep} />
        <ErrorState message="Failed" onRetry={onRetry} />
        <CardSkeleton />
        <ProductGridSkeleton count={2} />
        <ListSkeleton rows={2} />
        <StatGridSkeleton count={2} />
        <TableSkeleton rows={2} cols={3} />
      </div>,
    )

    expect(screen.getByTestId('stock-meter')).toHaveAttribute('data-stock-state', 'low')
    expect(screen.getByTestId('price-tag')).toHaveTextContent('₹45.00')
    expect(screen.getByTestId('price-tag-missing')).toHaveTextContent('Price not set')
    expect(screen.getByTestId('section-header')).toHaveAttribute('data-category-tone', 'roots')
    expect(screen.getByTestId('stat-card')).toHaveTextContent('₹4,500')

    fireEvent.click(screen.getByRole('button', { name: 'Browse Shop' }))
    expect(onNextStep).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    expect(screen.getByTestId('product-grid-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument()
  })

  it('renders /dev/styleguide with both light and dark showcase specimens', () => {
    renderWithProviders(<StyleGuidePage />)

    const light = screen.getByTestId('styleguide-light')
    const dark = screen.getByTestId('styleguide-dark')

    expect(light).toBeInTheDocument()
    expect(dark).toBeInTheDocument()
    expect(dark.closest('.dark')).not.toBeNull()
  })
})
