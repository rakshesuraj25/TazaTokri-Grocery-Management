import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CustomerOrderReceiptDialog } from '@/features/orders/components/CustomerOrderReceiptDialog'
import type { OrderResponse } from '@/features/orders/types'

const sampleOrder: OrderResponse = {
  id: 42,
  status: 'CONFIRMED',
  paymentMethod: 'COD',
  deliveryDate: '2026-11-23',
  deliveryAddress: '12 MG Road, Pune',
  deliveryPincode: '411001',
  deliveryInstructions: 'Ring bell',
  subtotal: 200,
  deliveryFee: 30,
  estimatedTotal: 230,
  finalTotal: null,
  createdAt: '2026-11-22T10:30:00',
  items: [
    {
      vegetableId: 1,
      vegetableName: 'Tomato',
      quantity: 2,
      unitPrice: 50,
      estimatedLineTotal: 100,
      actualQuantity: null,
      finalLineTotal: null,
    },
    {
      vegetableId: 2,
      vegetableName: 'Onion',
      quantity: 2.5,
      unitPrice: 40,
      estimatedLineTotal: 100,
      actualQuantity: null,
      finalLineTotal: null,
    },
  ],
}

describe('CustomerOrderReceiptDialog print reliability', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders accurate receipt content, updates @page rules for 58mm/80mm/A4, and triggers print once', async () => {
    const user = userEvent.setup()
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    render(<CustomerOrderReceiptDialog order={sampleOrder} onClose={() => {}} />)

    const receipt = await screen.findByTestId('customer-order-printable-receipt')
    expect(receipt).toHaveTextContent('ORD-#42')
    expect(receipt).toHaveTextContent('12 MG Road, Pune (411001)')
    expect(receipt).toHaveTextContent('Tomato')
    expect(receipt).toHaveTextContent('Onion')
    expect(receipt).toHaveTextContent('₹230.00')

    // Default 80mm @page rule
    const style80 = document.getElementById('receipt-page-size-style')
    expect(style80?.textContent).toContain('80mm auto')

    // Switch to 58mm
    await user.click(screen.getByRole('button', { name: '58mm' }))
    await waitFor(() => {
      expect(document.getElementById('receipt-page-size-style')?.textContent).toContain('58mm auto')
    })

    // Switch to A4
    await user.click(screen.getByRole('button', { name: 'A4' }))
    await waitFor(() => {
      expect(document.getElementById('receipt-page-size-style')?.textContent).toContain('A4 portrait')
    })

    // Print button calls window.print() once and sets printing-receipt class
    await user.click(screen.getByRole('button', { name: /print receipt/i }))
    expect(printSpy).toHaveBeenCalledTimes(1)
    expect(document.body.classList.contains('printing-receipt')).toBe(true)

    // Dialog close button and overlay carry no-print class
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('no-print')
  })
})
