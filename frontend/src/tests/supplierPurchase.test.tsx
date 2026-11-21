import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { purchaseApi } from '@/features/purchase/api'
import { catalogApi } from '@/features/catalog/api'
import SuppliersPage from '@/features/purchase/pages/SuppliersPage'
import SupplierDetailPage from '@/features/purchase/pages/SupplierDetailPage'
import NewPurchasePage from '@/features/purchase/pages/NewPurchasePage'
import { useAuthStore } from '@/features/auth/store'

function renderWithQuery(ui: React.ReactElement, initialEntries = ['/']) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Supplier Management & Purchase Tracking', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({
      user: {
        fullName: 'Owner',
        phone: '9876543210',
        roles: ['OWNER'],
      },
    })
  })

  it('renders supplier list, creates and edits a supplier with validation', async () => {
    const user = userEvent.setup()

    vi.spyOn(purchaseApi, 'getSupplierDashboard').mockResolvedValue({
      totalSuppliers: 1,
      activeSuppliers: 1,
      totalPurchases: '1200.00',
      totalPayments: '500.00',
      totalOutstandingPayable: '700.00',
      suppliers: [
        {
          id: 1,
          name: 'Ganesh Mandi',
          type: 'WHOLESALE_MARKET',
          phone: '9876543211',
          address: 'Market Yard',
          notes: 'Morning lot',
          active: true,
          purchaseCount: 2,
          totalPurchases: '1200.00',
          totalPayments: '500.00',
          outstandingPayable: '700.00',
          lastPurchaseDate: '2026-11-20',
        },
      ],
    })

    const createSpy = vi.spyOn(purchaseApi, 'createSupplier').mockResolvedValue({
      id: 2,
      name: 'Kisan Farm',
      type: 'FARMER',
      phone: '9876500001',
      address: 'Nashik',
      active: true,
    })

    const updateSpy = vi.spyOn(purchaseApi, 'updateSupplier').mockResolvedValue({
      id: 1,
      name: 'Ganesh Mandi Updated',
      type: 'WHOLESALE_MARKET',
      phone: '9876543211',
      address: 'Gate 2',
      active: true,
    })

    renderWithQuery(<SuppliersPage />)

    expect(await screen.findByText('Ganesh Mandi')).toBeInTheDocument()
    expect(screen.getAllByText('₹700.00').length).toBeGreaterThanOrEqual(1)

    // Validation error when name is empty
    await user.click(screen.getByRole('button', { name: /add supplier/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()

    // Create supplier
    await user.type(screen.getByLabelText(/supplier name/i), 'Kisan Farm')
    await user.type(screen.getByLabelText(/mobile number/i), '9876500001')
    await user.type(screen.getByLabelText(/address/i), 'Nashik')
    await user.click(screen.getByRole('button', { name: /add supplier/i }))

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Kisan Farm',
          phone: '9876500001',
          address: 'Nashik',
        }),
      ),
    )

    // Edit existing supplier
    await user.click(screen.getByRole('button', { name: /edit ganesh mandi/i }))
    const nameInput = screen.getByLabelText(/supplier name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Ganesh Mandi Updated')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Ganesh Mandi Updated' }),
      ),
    )
  })

  it('displays supplier detail, outstanding balance, validates overpayment, and records payment', async () => {
    const user = userEvent.setup()

    vi.spyOn(purchaseApi, 'getSupplierDetail').mockResolvedValue({
      summary: {
        id: 1,
        name: 'Ganesh Mandi',
        type: 'WHOLESALE_MARKET',
        phone: '9876543211',
        address: 'Market Yard',
        active: true,
        purchaseCount: 1,
        totalPurchases: '1000.00',
        totalPayments: '400.00',
        outstandingPayable: '600.00',
        lastPurchaseDate: '2026-11-20',
      },
      purchases: [
        {
          id: 10,
          supplierId: 1,
          supplierName: 'Ganesh Mandi',
          purchaseDate: '2026-11-20',
          invoiceNumber: 'INV-10',
          status: 'COMPLETED',
          transportCost: '0.00',
          totalCost: '1000.00',
          paidAmount: '400.00',
          outstandingAmount: '600.00',
          paymentStatus: 'PARTIAL',
          items: [],
        },
      ],
      payments: [
        {
          id: 50,
          supplierId: 1,
          supplierName: 'Ganesh Mandi',
          purchaseId: 10,
          amount: '400.00',
          paymentMethod: 'UPI',
          paymentDate: '2026-11-20',
          referenceNumber: 'UTR-1',
        },
      ],
    })

    const paySpy = vi.spyOn(purchaseApi, 'recordSupplierPayment').mockResolvedValue({
      id: 51,
      supplierId: 1,
      supplierName: 'Ganesh Mandi',
      purchaseId: 10,
      amount: '300.00',
      paymentMethod: 'CASH',
      paymentDate: '2026-11-21',
    })

    renderWithQuery(
      <Routes>
        <Route path="/staff/suppliers/:id" element={<SupplierDetailPage />} />
      </Routes>,
      ['/staff/suppliers/1'],
    )

    expect(await screen.findByRole('heading', { name: 'Ganesh Mandi' })).toBeInTheDocument()
    expect(screen.getByText('₹600.00')).toBeInTheDocument()

    // Overpayment client-side guard
    const amountInput = screen.getByLabelText(/amount/i)
    await user.type(amountInput, '800')
    await user.click(screen.getByRole('button', { name: /record payment/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/exceeds outstanding payable/i)
    expect(paySpy).not.toHaveBeenCalled()

    // Valid partial payment
    await user.clear(amountInput)
    await user.type(amountInput, '300')
    await user.click(screen.getByRole('button', { name: /record payment/i }))

    await waitFor(() =>
      expect(paySpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          amount: '300.00',
          paymentMethod: 'CASH',
        }),
      ),
    )
  })

  it('creates a purchase with invoice number and idempotency key', async () => {
    const user = userEvent.setup()

    vi.spyOn(purchaseApi, 'listSuppliers').mockResolvedValue([
      { id: 1, name: 'Ganesh Mandi', type: 'WHOLESALE_MARKET', active: true },
    ])
    vi.spyOn(catalogApi, 'listVegetables').mockResolvedValue([
      {
        id: 10,
        nameEn: 'Tomato',
        nameMr: 'टोमॅटो',
        nameHi: 'टमाटर',
        baseUnit: 'KG',
        active: true,
        available: true,
        categoryId: 1,
        categoryName: 'Vegetables',
        currentStock: '0',
      },
    ] as never)

    const createPurchaseSpy = vi.spyOn(purchaseApi, 'createPurchase').mockResolvedValue({
      id: 99,
      supplierId: 1,
      supplierName: 'Ganesh Mandi',
      purchaseDate: '2026-11-21',
      invoiceNumber: 'INV-99',
      status: 'COMPLETED',
      transportCost: '50.00',
      totalCost: '550.00',
      items: [],
    })

    renderWithQuery(<NewPurchasePage />)

    const supSelect = await screen.findByLabelText(/supplier/i)
    await screen.findByRole('option', { name: 'Ganesh Mandi' })
    await user.selectOptions(supSelect, '1')
    await user.type(screen.getByLabelText(/invoice/i), 'INV-99')

    await screen.findByRole('option', { name: /tomato/i })
    const vegSelect = screen.getByLabelText(/vegetable/i)
    await user.selectOptions(vegSelect, '10')

    const qtyInput = screen.getByLabelText(/quantity/i)
    await user.type(qtyInput, '10')
    const rateInput = screen.getByLabelText(/rate/i)
    await user.type(rateInput, '50')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(createPurchaseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: 1,
          invoiceNumber: 'INV-99',
          idempotencyKey: expect.any(String),
        }),
      ),
    )
  })
})
