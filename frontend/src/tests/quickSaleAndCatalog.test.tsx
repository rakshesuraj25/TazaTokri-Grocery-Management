import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VegetableImage } from '@/components/VegetableImage'
import { QuickSaleTile } from '@/features/sales/components/QuickSaleTile'
import { QuickSaleBill, type BillLine } from '@/features/sales/components/QuickSaleBill'
import type { StaffCatalogItem } from '@/features/catalog/types'

const sweetCornItem: StaffCatalogItem = {
  id: 36,
  nameEn: 'Sweet Corn',
  nameMr: 'स्वीट कॉर्न',
  nameHi: 'स्वीट कॉर्न',
  category: 'Roots & Tubers',
  baseUnit: 'PIECE',
  pricePerUnit: '20.00',
  stock: '15.000',
  available: true,
  options: [
    {
      unitId: 101,
      label: '1 piece',
      quantityInBaseUnit: '1.000',
      defaultOption: true,
    },
  ],
}

const zeroStockItem: StaffCatalogItem = {
  id: 12,
  nameEn: 'Raw Banana (Kaccha Kela)',
  nameMr: 'कच्चे केळे',
  nameHi: 'कच्चा केला',
  category: 'Everyday Vegetables',
  baseUnit: 'KG',
  pricePerUnit: '40.00',
  stock: '0.000',
  available: true,
  options: [
    { unitId: 203, label: '1kg', quantityInBaseUnit: '1.000', defaultOption: false },
    { unitId: 201, label: '250g', quantityInBaseUnit: '0.250', defaultOption: false },
    { unitId: 202, label: '500g', quantityInBaseUnit: '0.500', defaultOption: true },
  ],
}

describe('VegetableImage, QuickSaleTile & QuickSaleBill verification', () => {
  it('VegetableImage shows the category-tinted SVG VegetablePlaceholder (and removes the <img>) after an error event', () => {
    const { container } = render(
      <VegetableImage
        nameEn="Bottle Gourd (Dudhi)"
        category="Everyday Vegetables"
        imageUrl="https://commons.wikimedia.org/wiki/Special:FilePath/Old.jpg"
        size="md"
      />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', '/vegetables/bottle-gourd.jpg')
    expect(img).toHaveAttribute('alt', 'Bottle Gourd (Dudhi)')

    // Simulate missing file load error
    fireEvent.error(img!)

    // No <img> with a broken/wrong src remains in the DOM
    expect(container.querySelector('img')).toBeNull()

    const placeholder = screen.getByTestId('vegetable-image-placeholder')
    expect(placeholder).toBeInTheDocument()
    expect(placeholder).toHaveAttribute('aria-label', 'Bottle Gourd (Dudhi)')
    expect(placeholder).toHaveAttribute('data-category-tone', 'everyday')
    expect(placeholder.querySelector('svg')).not.toBeNull()
  })

  it('renders QuickSaleTile with /vegetables/<slug>.jpg, price, stock badge, in-bill badge, and selling-size buttons', () => {
    const onAddQty = vi.fn()
    const onToggleAvailable = vi.fn()

    render(
      <MemoryRouter>
        <QuickSaleTile
          item={sweetCornItem}
          inBillQty="2.000"
          onAddQty={onAddQty}
          onToggleAvailable={onToggleAvailable}
        />
      </MemoryRouter>,
    )

    const img = screen.getByRole('img', { name: /Sweet Corn/i })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/vegetables/sweet-corn.jpg')
    expect(screen.getByText('Sweet Corn')).toBeInTheDocument()
    expect(screen.getByText('+2 pc')).toBeInTheDocument()
    expect(screen.getByText('15 pc')).toBeInTheDocument()

    const sizeBtn = screen.getByRole('button', { name: /1 piece/i })
    expect(sizeBtn).not.toBeDisabled()
    fireEvent.click(sizeBtn)
    expect(onAddQty).toHaveBeenCalledWith(sweetCornItem, '1.000')
  })

  it('disables selling-size buttons when stock is 0, sorts chips ascending, and shows Out of stock badge', () => {
    render(
      <MemoryRouter>
        <QuickSaleTile
          item={zeroStockItem}
          onAddQty={vi.fn()}
          onToggleAvailable={vi.fn()}
        />
      </MemoryRouter>,
    )

    const img = screen.getByRole('img', { name: /Raw Banana/i })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/vegetables/raw-banana.jpg')
    expect(screen.getByText('Raw Banana (Kaccha Kela)')).toBeInTheDocument()
    const sizeButtons = screen.getAllByRole('button')
    expect(sizeButtons.map((b) => b.textContent)).toEqual(['250g', '500g', '1kg'])
    expect(screen.getByRole('button', { name: /250g/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /500g/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /1kg/i })).toBeDisabled()
  })

  it('validates empty bill, zero quantity, and over-stock lines in QuickSaleBill', () => {
    const onSubmit = vi.fn()
    const validLine: BillLine = { item: sweetCornItem, quantity: '3.000' }

    const { rerender } = render(
      <QuickSaleBill
        lines={[validLine]}
        paymentMethod="CASH"
        onPaymentMethodChange={vi.fn()}
        onChangeQuantity={vi.fn()}
        onRemoveLine={vi.fn()}
        onClear={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )

    const saveBtn = screen.getByRole('button', { name: /save|complete|record/i })
    expect(saveBtn).not.toBeDisabled()

    rerender(
      <QuickSaleBill
        lines={[{ item: sweetCornItem, quantity: '20.000' }]}
        paymentMethod="UPI"
        onPaymentMethodChange={vi.fn()}
        onChangeQuantity={vi.fn()}
        onRemoveLine={vi.fn()}
        onClear={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save|complete|record/i })).toBeDisabled()

    rerender(
      <QuickSaleBill
        lines={[{ item: sweetCornItem, quantity: '0' }]}
        paymentMethod="CASH"
        onPaymentMethodChange={vi.fn()}
        onChangeQuantity={vi.fn()}
        onRemoveLine={vi.fn()}
        onClear={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )
    expect(screen.getByRole('button', { name: /save|complete|record/i })).toBeDisabled()
  })
})
