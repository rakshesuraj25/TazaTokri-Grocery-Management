import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import {
  getReceiptConfig,
  resetReceiptConfig,
  saveReceiptConfig,
} from '@/features/sales/receiptSettings'
import { SaleReceiptDialog } from '@/features/sales/components/SaleReceiptDialog'
import {
  CustomerOrderReceiptDialog,
  resolveOrderDocumentKind,
} from '@/features/orders/components/CustomerOrderReceiptDialog'
import { WASTAGE_REASONS } from '@/features/inventory/components/StockModals'
import { InvoiceScannerCard } from '@/features/purchase/components/InvoiceScannerCard'
import { AiQuickSaleAssistantDialog } from '@/features/sales/components/AiQuickSaleAssistantDialog'
import type { OrderResponse } from '@/features/orders/types'
import type { SaleResponse } from '@/features/sales/types'
import type { StaffCatalogItem, VegetableResponse } from '@/features/catalog/types'

const mockExtractInvoice = vi.fn()
const mockExtractQuickSale = vi.fn()

vi.mock('@/features/ai/hooks', () => ({
  useAiStatus: () => ({
    data: {
      enabled: false,
      configured: false,
      model: 'gemini-4-hydrogen',
      maxUploadBytes: 5242880,
      supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      message: 'Local multilingual text parsing and manual entry are ready.',
    },
  }),
  useExtractPurchaseInvoice: () => ({
    isPending: false,
    mutate: (
      input: unknown,
      opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void },
    ) => {
      const res = mockExtractInvoice(input)
      opts?.onSuccess?.(res)
    },
  }),
  useExtractQuickSaleList: () => ({
    isPending: false,
    mutate: (
      input: unknown,
      opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void },
    ) => {
      const res = mockExtractQuickSale(input)
      opts?.onSuccess?.(res)
    },
  }),
}))

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

const sampleCatalog: VegetableResponse[] = [
  {
    id: 1,
    nameEn: 'Onion',
    nameMr: 'कांदा',
    nameHi: 'प्याज',
    categoryId: 1,
    categoryName: 'BULB',
    baseUnit: 'KG',
    active: true,
    available: true,
    units: [],
  },
  {
    id: 2,
    nameEn: 'Tomato',
    nameMr: 'टोमॅटो',
    nameHi: 'टमाटर',
    categoryId: 2,
    categoryName: 'FRUIT',
    baseUnit: 'KG',
    active: true,
    available: true,
    units: [],
  },
]

const sampleStaffCatalog: StaffCatalogItem[] = [
  {
    id: 1,
    nameEn: 'Onion',
    nameMr: 'कांदा',
    nameHi: 'प्याज',
    category: 'BULB',
    baseUnit: 'KG',
    available: true,
    stock: '25.000',
    pricePerUnit: '40.00',
    options: [],
  },
  {
    id: 2,
    nameEn: 'Tomato',
    nameMr: 'टोमॅटो',
    nameHi: 'टमाटर',
    category: 'FRUIT',
    baseUnit: 'KG',
    available: true,
    stock: '12.000',
    pricePerUnit: '30.00',
    options: [],
  },
]

describe('Phase 3 — Thermal Receipt Printing, Operations, Freshness & AI Draft Workflows', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('persists 58mm, 80mm, and A4 thermal receipt paper width and store metadata', () => {
    const defaults = getReceiptConfig()
    expect(defaults.preferredWidth).toBe('80mm')
    expect(defaults.storeName).toBe('TazaTokri')

    const updated = saveReceiptConfig({
      preferredWidth: '58mm',
      contactPhone: '+91 98765 43210',
      storeAddress: 'Shop 4, Market Yard, Pune',
    })
    expect(updated.preferredWidth).toBe('58mm')
    expect(getReceiptConfig().preferredWidth).toBe('58mm')
    expect(getReceiptConfig().contactPhone).toBe('+91 98765 43210')

    const reset = resetReceiptConfig()
    expect(reset.preferredWidth).toBe('80mm')
  })

  it('renders Quick Sale thermal receipt with 58mm/80mm/A4 selector, SALE-# ref, and PAID status', () => {
    const sale: SaleResponse = {
      id: 305,
      createdAt: '2026-11-18T11:30:00',
      paymentMethod: 'UPI',
      totalAmount: '110.00',
      soldBy: 2,
      items: [
        {
          vegetableId: 1,
          vegetableName: 'Onion',
          baseUnit: 'KG',
          quantity: '2.000',
          unitPrice: '40.00',
          lineTotal: '80.00',
        },
        {
          vegetableId: 2,
          vegetableName: 'Tomato',
          baseUnit: 'KG',
          quantity: '1.000',
          unitPrice: '30.00',
          lineTotal: '30.00',
        },
      ],
    }

    render(<SaleReceiptDialog sale={sale} onClose={() => {}} />, {
      wrapper: createWrapper(),
    })

    const receipt = screen.getByRole('dialog')
    expect(receipt.textContent).toContain('#305')
    expect(receipt.textContent).toContain('UPI')
    expect(receipt.textContent).toContain('PAID')
    expect(receipt.textContent).toContain('Onion')
    expect(receipt.textContent).toContain('Tomato')

    const btn58 = screen.getByRole('radio', { name: '58mm' })
    fireEvent.click(btn58)
    expect(getReceiptConfig().preferredWidth).toBe('58mm')
  })

  it('distinguishes customer Order Confirmation vs Completed Payment Receipt and blocks unpaid/cancelled orders', () => {
    const baseOrder: OrderResponse = {
      id: 901,
      status: 'PLACED',
      paymentMethod: 'COD',
      deliveryDate: '2026-11-19',
      deliveryAddress: 'Flat 12, Kothrud, Pune',
      deliveryPincode: '411038',
      subtotal: '200.00',
      deliveryFee: '30.00',
      estimatedTotal: '230.00',
      finalTotal: null,
      createdAt: '2026-11-18T10:15:00',
      items: [
        {
          vegetableId: 1,
          vegetableName: 'Onion',
          quantity: '5.000',
          unitPrice: '40.00',
          estimatedLineTotal: '200.00',
          actualQuantity: null,
          finalLineTotal: null,
        },
      ],
    }

    // 1. COD PLACED order is an ORDER_CONFIRMATION (never a paid receipt)
    expect(resolveOrderDocumentKind(baseOrder)).toBe('ORDER_CONFIRMATION')

    // 2. DELIVERED order is a PAYMENT_RECEIPT
    expect(resolveOrderDocumentKind({ ...baseOrder, status: 'DELIVERED', finalTotal: '230.00' })).toBe(
      'PAYMENT_RECEIPT',
    )

    // 3. ONLINE paid order (CONFIRMED) is a PAYMENT_RECEIPT
    expect(
      resolveOrderDocumentKind({ ...baseOrder, status: 'CONFIRMED', paymentMethod: 'ONLINE' }),
    ).toBe('PAYMENT_RECEIPT')

    // 4. PENDING_PAYMENT or CANCELLED orders are UNPAID_NOTICE
    expect(
      resolveOrderDocumentKind({ ...baseOrder, status: 'PENDING_PAYMENT', paymentMethod: 'ONLINE' }),
    ).toBe('UNPAID_NOTICE')
    expect(resolveOrderDocumentKind({ ...baseOrder, status: 'CANCELLED' })).toBe('UNPAID_NOTICE')

    render(<CustomerOrderReceiptDialog order={baseOrder} onClose={() => {}} />, {
      wrapper: createWrapper(),
    })
    const doc = screen.getByTestId('customer-order-printable-receipt')
    expect(doc.getAttribute('data-doc-kind')).toBe('ORDER_CONFIRMATION')
    expect(doc.textContent).toContain('ORD-#901')
    expect(doc.textContent).toContain('DUE ON DELIVERY')
  })

  it('includes all 6 structured stock loss / wastage reasons', () => {
    expect(WASTAGE_REASONS).toEqual([
      'Spoiled',
      'Damaged',
      'Expired',
      'Trimmed',
      'Returned',
      'Other',
    ])
  })

  it('requires staff to map unmatched AI invoice items before loading draft into Purchase Form', async () => {
    mockExtractInvoice.mockReturnValue({
      supplierName: 'Shri Ganesh Traders',
      matchedSupplierId: 1,
      invoiceDate: '2026-11-18',
      invoiceNumber: 'INV-88',
      transportCost: '150.00',
      invoiceGrandTotal: '2500.00',
      calculatedItemsTotal: '2050.00',
      calculatedGrandTotal: '2200.00',
      totalMismatch: true,
      totalMismatchWarning:
        'Extracted invoice total (₹2500.00) does not match calculated sum of lines + transport (₹2200.00).',
      unmatchedItemsCount: 1,
      extractionSource: 'LOCAL_PARSER',
      warnings: [
        'Extracted invoice total (₹2500.00) does not match calculated sum of lines + transport (₹2200.00).',
      ],
      items: [
        {
          rawItemName: 'Kanda',
          vegetableId: 1,
          matchedVegetableName: 'Onion',
          baseUnit: 'KG',
          quantity: '50.000',
          rawUnit: 'KG',
          ratePerUnit: '25.00',
          extractedLineTotal: '1250.00',
          calculatedLineTotal: '1250.00',
          lineTotalMismatch: false,
          matched: true,
          confidence: 'HIGH',
          note: null,
        },
        {
          rawItemName: 'Unknown Exotic Herb',
          vegetableId: null,
          matchedVegetableName: null,
          baseUnit: null,
          quantity: '25.000',
          rawUnit: 'KG',
          ratePerUnit: '32.00',
          extractedLineTotal: '800.00',
          calculatedLineTotal: '800.00',
          lineTotalMismatch: false,
          matched: false,
          confidence: 'UNMATCHED',
          note: 'Unmatched item: select a catalog vegetable before saving.',
        },
      ],
    })

    const onApply = vi.fn()
    render(
      <InvoiceScannerCard vegetables={sampleCatalog} onApplyToForm={onApply} />,
      { wrapper: createWrapper() },
    )

    fireEvent.click(screen.getByRole('button', { name: /Scan \/ Paste Invoice/i }))
    const textarea = screen.getByLabelText(/Or Paste Supplier Bill Lines/i)
    fireEvent.change(textarea, {
      target: { value: 'Kanda | 50 kg | 25\nUnknown Exotic Herb | 25 kg | 32' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Extract Purchase Draft/i }))

    await waitFor(() => {
      expect(screen.getByTestId('ai-invoice-draft-review')).toBeTruthy()
    })

    // Attempting to load draft while an item is still unmatched is blocked
    fireEvent.click(
      screen.getByRole('button', { name: /Load Verified Draft into Purchase Form/i }),
    )
    expect(onApply).not.toHaveBeenCalled()

    // Map the unmatched line to Tomato (id=2)
    const select = screen.getByLabelText('Map vegetable for Unknown Exotic Herb')
    fireEvent.change(select, { target: { value: '2' } })

    fireEvent.click(
      screen.getByRole('button', { name: /Load Verified Draft into Purchase Form/i }),
    )
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0][0].items).toHaveLength(2)
  })

  it('extracts customer grocery list items in Quick Sale AI assistant and loads confirmed items into POS bill', async () => {
    mockExtractQuickSale.mockReturnValue({
      extractionSource: 'LOCAL_PARSER',
      totalExtractedCount: 2,
      matchedCount: 2,
      unmatchedCount: 0,
      estimatedSubtotal: '95.00',
      warnings: [],
      items: [
        {
          rawLineText: '2 kg onion',
          rawItemName: 'onion',
          vegetableId: 1,
          matchedVegetableName: 'Onion',
          matchedNameMr: 'कांदा',
          matchedNameHi: 'प्याज',
          baseUnit: 'KG',
          quantity: '2.000',
          rawUnit: 'KG',
          currentUnitPrice: '40.00',
          estimatedLineTotal: '80.00',
          availableStock: '25.000',
          stockSufficient: true,
          matched: true,
          confidence: 'HIGH',
          warning: null,
        },
        {
          rawLineText: '500 g tomato',
          rawItemName: 'tomato',
          vegetableId: 2,
          matchedVegetableName: 'Tomato',
          matchedNameMr: 'टोमॅटो',
          matchedNameHi: 'टमाटर',
          baseUnit: 'KG',
          quantity: '0.500',
          rawUnit: 'G',
          currentUnitPrice: '30.00',
          estimatedLineTotal: '15.00',
          availableStock: '12.000',
          stockSufficient: true,
          matched: true,
          confidence: 'HIGH',
          warning: null,
        },
      ],
    })

    const onLoadIntoBill = vi.fn()
    render(
      <AiQuickSaleAssistantDialog
        open={true}
        onOpenChange={() => {}}
        catalog={sampleStaffCatalog}
        onLoadIntoBill={onLoadIntoBill}
      />,
      { wrapper: createWrapper() },
    )

    const textarea = screen.getByLabelText(/Type \/ Paste Customer Grocery List/i)
    fireEvent.change(textarea, { target: { value: '2 kg onion\n500 g tomato' } })

    fireEvent.click(screen.getByRole('button', { name: /Extract Quick Sale Draft/i }))

    await waitFor(() => {
      expect(screen.getByTestId('ai-quicksale-draft-review')).toBeTruthy()
    })

    fireEvent.click(
      screen.getByRole('button', { name: /Load Confirmed Items into Quick Sale Bill/i }),
    )
    expect(onLoadIntoBill).toHaveBeenCalledTimes(1)
    expect(onLoadIntoBill.mock.calls[0][0]).toEqual([
      { item: sampleStaffCatalog[0], quantity: '2' },
      { item: sampleStaffCatalog[1], quantity: '0.5' },
    ])
  })
})
