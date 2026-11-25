import { beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StaffLayout } from '@/components/layout/StaffLayout'
import { useAuthStore } from '@/features/auth/store'
import SuppliersPage from '@/features/purchase/pages/SuppliersPage'
import PurchasesPage from '@/features/purchase/pages/PurchasesPage'
import CustomerOrdersPage from '@/features/orders/pages/CustomerOrdersPage'

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

function wrap(ui: React.ReactElement, initialRoute = '/') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe('Final UI/UX Redesign — Collapsible Sidebar & Operational Views', () => {
  it('toggles desktop StaffLayout sidebar between expanded and collapsed states cleanly', () => {
    window.localStorage.removeItem('tazatokri.sidebar.collapsed')
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })

    useAuthStore.setState({
      user: {
        userId: 1,
        fullName: 'Asha Owner',
        phone: '9999999999',
        roles: ['OWNER', 'STAFF', 'DELIVERY'],
      },
    })

    wrap(
      <Routes>
        <Route path="/staff" element={<StaffLayout />}>
          <Route path="stock" element={<div>Stock inner</div>} />
        </Route>
      </Routes>,
      '/staff/stock',
    )

    const sidebar = screen.getByTestId('staff-sidebar')
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')

    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))
    expect(sidebar).toHaveAttribute('data-collapsed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /expand sidebar/i }))
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')
  })

  it('renders SuppliersPage KPI overview and supports type filters and search', async () => {
    useAuthStore.setState({
      user: {
        userId: 1,
        fullName: 'Asha Owner',
        phone: '9999999999',
        roles: ['OWNER'],
      },
    })

    server.use(
      http.get('*/api/suppliers/dashboard', () =>
        HttpResponse.json({
          totalSuppliers: 2,
          activeSuppliers: 2,
          totalPurchases: '1450.00',
          totalPayments: '0.00',
          totalOutstandingPayable: '1450.00',
          suppliers: [
            {
              id: 1,
              name: 'Deshmukh Farm',
              type: 'FARMER',
              phone: '9822112233',
              active: true,
              purchaseCount: 1,
              totalPurchases: '1450.00',
              totalPayments: '0.00',
              outstandingPayable: '1450.00',
              lastPurchaseDate: '2026-11-16',
            },
            {
              id: 2,
              name: 'Marketyard Wholesale',
              type: 'WHOLESALE_MARKET',
              phone: null,
              active: true,
              purchaseCount: 0,
              totalPurchases: '0.00',
              totalPayments: '0.00',
              outstandingPayable: '0.00',
              lastPurchaseDate: null,
            },
          ],
        }),
      ),
      http.get('*/api/suppliers', () =>
        HttpResponse.json([
          { id: 1, name: 'Deshmukh Farm', type: 'FARMER', phone: '9822112233', active: true },
          { id: 2, name: 'Marketyard Wholesale', type: 'WHOLESALE_MARKET', phone: null, active: true },
        ]),
      ),
      http.get('*/api/purchases', () =>
        HttpResponse.json([
          {
            id: 10,
            supplierId: 1,
            supplierName: 'Deshmukh Farm',
            purchaseDate: '2026-11-16',
            transportCost: '50.00',
            totalCost: '1450.00',
            items: [
              {
                vegetableId: 1,
                vegetableName: 'Tomato',
                quantity: '25.000',
                ratePerUnit: '56.00',
                lineCost: '1400.00',
                transportShare: '50.00',
                landedCostPerUnit: '58.00',
              },
            ],
          },
        ]),
      ),
    )

    wrap(<SuppliersPage />)

    await waitFor(() => {
      expect(screen.getByText('Deshmukh Farm')).toBeInTheDocument()
    })
    expect(screen.getByText('Marketyard Wholesale')).toBeInTheDocument()
    expect(screen.getAllByText('₹1,450.00').length).toBeGreaterThanOrEqual(1)

    // Filter to Farmers via type select
    fireEvent.change(screen.getByLabelText('Filter by type'), { target: { value: 'FARMER' } })
    expect(screen.getByText('Deshmukh Farm')).toBeInTheDocument()
    expect(screen.queryByText('Marketyard Wholesale')).not.toBeInTheDocument()
  })

  it('renders PurchasesPage summary metrics and table view toggle', async () => {
    useAuthStore.setState({
      user: { userId: 1, fullName: 'Asha Owner', phone: '9999999999', roles: ['OWNER'] },
    })

    server.use(
      http.get('*/api/purchases', () =>
        HttpResponse.json([
          {
            id: 11,
            supplierId: 1,
            supplierName: 'Deshmukh Farm',
            purchaseDate: '2026-11-16',
            transportCost: '50.00',
            totalCost: '1450.00',
            items: [
              {
                vegetableId: 1,
                vegetableName: 'Tomato',
                quantity: '25.000',
                ratePerUnit: '56.00',
                lineCost: '1400.00',
                transportShare: '50.00',
                landedCostPerUnit: '58.00',
              },
            ],
          },
        ]),
      ),
    )

    wrap(<PurchasesPage />)

    await waitFor(() => {
      expect(screen.getByText('Deshmukh Farm')).toBeInTheDocument()
    })
    expect(screen.getAllByText('₹1,450.00').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByRole('button', { name: 'Table view' }))
    expect(screen.getByRole('table', { name: 'Purchases' })).toBeInTheDocument()
  })

  it('renders CustomerOrdersPage with active/delivered/cancelled filters and progress stepper', async () => {
    useAuthStore.setState({
      user: { userId: 5, fullName: 'Priya', phone: '9876543210', roles: ['CUSTOMER'] },
    })

    server.use(
      http.get('*/api/customer/orders', () =>
        HttpResponse.json([
          {
            id: 201,
            status: 'CONFIRMED',
            paymentMethod: 'COD',
            subtotal: '220.00',
            estimatedTotal: '250.00',
            finalTotal: null,
            deliveryFee: '30.00',
            deliveryDate: '2026-11-16',
            deliveryAddress: 'Line 1',
            deliveryPincode: '411038',
            createdAt: '2026-11-16T08:00:00Z',
            items: [],
          },
          {
            id: 202,
            status: 'DELIVERED',
            paymentMethod: 'ONLINE',
            subtotal: '340.00',
            estimatedTotal: '340.00',
            finalTotal: '340.00',
            deliveryFee: '0.00',
            deliveryDate: '2026-11-15',
            deliveryAddress: 'Line 1',
            deliveryPincode: '411038',
            createdAt: '2026-11-15T08:00:00Z',
            items: [],
          },
        ]),
      ),
      http.get('*/api/public/vegetables', () => HttpResponse.json([])),
    )

    wrap(<CustomerOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('#201')).toBeInTheDocument()
    })
    expect(screen.getByText('#202')).toBeInTheDocument()
    expect(screen.getByTestId('order-status-stepper')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Delivered \(1\)/i }))
    expect(screen.queryByText('#201')).not.toBeInTheDocument()
    expect(screen.getByText('#202')).toBeInTheDocument()
  })
})
