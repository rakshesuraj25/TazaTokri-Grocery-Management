import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import '@/i18n'
import { useCartStore } from '@/features/cart/store'
import { CartContents } from '@/features/cart/components/CartContents'
import {
  buildCustomerSupportWaUrl,
  buildWaMeUrl,
  formatOrderWhatsAppMessage,
  mapOrderStatusToEvent,
  normalizeIndianWhatsAppPhone,
} from '@/features/notifications/whatsappTemplates'
import { NotificationPreferencesCard } from '@/features/notifications/components/NotificationPreferencesCard'
import { CustomerOrderWhatsAppBar } from '@/features/notifications/components/CustomerOrderWhatsAppBar'
import { ShopCombosSection } from '@/features/combos/components/ShopCombosSection'
import { SavedBasketsSection } from '@/features/baskets/components/SavedBasketsSection'
import { buildUsualVegetables, mapOrderItemsToCart } from '@/features/orders/orderAgain'
import type { ComboDto } from '@/features/combos/types'
import type { SavedBasketDto } from '@/features/baskets/types'

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Phase 2 — WhatsApp Communication, Combo Packs, Recurring Baskets & Retention', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], combos: [], clientRef: 'phase2-ref-1' })
  })

  describe('Task 1: WhatsApp Order Communication & Notification Preferences', () => {
    it('generates localized EN, MR, and HI messages for all 6 order events and builds valid wa.me links', () => {
      expect(normalizeIndianWhatsAppPhone('9822011223')).toBe('919822011223')
      expect(normalizeIndianWhatsAppPhone('+91 98220-11223')).toBe('919822011223')

      expect(mapOrderStatusToEvent('PLACED')).toBe('ORDER_PLACED')
      expect(mapOrderStatusToEvent('CONFIRMED')).toBe('ORDER_CONFIRMED')
      expect(mapOrderStatusToEvent('PACKED')).toBe('ORDER_PACKED')
      expect(mapOrderStatusToEvent('OUT_FOR_DELIVERY')).toBe('OUT_FOR_DELIVERY')
      expect(mapOrderStatusToEvent('DELIVERED')).toBe('DELIVERED')
      expect(mapOrderStatusToEvent('CANCELLED')).toBe('CANCELLED')

      const placedEn = formatOrderWhatsAppMessage({
        event: 'ORDER_PLACED',
        orderId: 123,
        customerName: 'Priya',
        billAmount: '240.00',
        language: 'EN',
      })
      expect(placedEn).toContain('Hello Priya!')
      expect(placedEn).toContain('order #123')
      expect(placedEn).toContain('has been received')

      const confirmedMr = formatOrderWhatsAppMessage({
        event: 'ORDER_CONFIRMED',
        orderId: 123,
        customerName: 'प्रिया',
        language: 'MR',
      })
      expect(confirmedMr).toContain('#123')
      expect(confirmedMr).toContain('ताजा टोकरी')

      const deliveredHi = formatOrderWhatsAppMessage({
        event: 'DELIVERED',
        orderId: 123,
        customerName: 'प्रिया',
        language: 'HI',
      })
      expect(deliveredHi).toContain('#123')
      expect(deliveredHi).toContain('ताज़ा टोकरी')

      const waUrl = buildWaMeUrl('9822011223', placedEn)
      expect(waUrl).toMatch(/^https:\/\/wa\.me\/919822011223\?text=/)

      const supportUrl = buildCustomerSupportWaUrl(123, 'PACKED', '9999999999')
      expect(supportUrl).toContain('https://wa.me/919999999999?text=')
      expect(decodeURIComponent(supportUrl)).toContain('order #123')
    })

    it('renders NotificationPreferencesCard and CustomerOrderWhatsAppBar cleanly', async () => {
      server.use(
        http.get('*/api/my/notifications/preferences', () =>
          HttpResponse.json({
            userId: 10,
            whatsappOptIn: false,
            consentTimestamp: null,
            preferredLanguage: 'MR',
            cloudApiEnabled: false,
          }),
        ),
        http.put('*/api/my/notifications/preferences', async ({ request }) => {
          const body = (await request.json()) as {
            whatsappOptIn: boolean
            preferredLanguage: string
          }
          return HttpResponse.json({
            userId: 10,
            whatsappOptIn: body.whatsappOptIn,
            consentTimestamp: '2026-11-18T12:00:00',
            preferredLanguage: body.preferredLanguage,
            cloudApiEnabled: false,
          })
        }),
      )

      renderWithProviders(
        <div>
          <NotificationPreferencesCard />
          <CustomerOrderWhatsAppBar
            order={{
              id: 123,
              status: 'CONFIRMED',
              paymentMethod: 'COD',
              deliveryDate: '2026-11-18',
              deliveryAddress: 'Kothrud, Pune',
              deliveryPincode: '411038',
              subtotal: '200.00',
              deliveryFee: '30.00',
              estimatedTotal: '230.00',
              finalTotal: null,
              createdAt: '2026-11-18T10:00:00',
              items: [],
            }}
          />
        </div>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('notification-preferences-card')).toHaveTextContent(
          /opted out/i,
        )
      })

      const toggle = screen.getByRole('switch', { name: /enable whatsapp notifications/i })
      fireEvent.click(toggle)

      await waitFor(() => {
        expect(screen.getByTestId('notification-preferences-card')).toHaveTextContent(
          /opted in/i,
        )
      })

      expect(screen.getByTestId('customer-order-whatsapp-bar')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /share status/i })).toHaveAttribute(
        'href',
        expect.stringContaining('wa.me'),
      )
    })
  })

  describe('Task 2: Vegetable Combo Packs & Cart Integration', () => {
    it('renders combo packs with savings and recommendation badges, caps count at maxAvailableCombos, and includes combos in cart subtotal', () => {
      const sampleCombo: ComboDto = {
        id: 501,
        nameEn: 'Daily Cooking Combo',
        nameMr: 'दैनंदिन स्वयंपाक कॉम्बो',
        nameHi: 'दैनिक रसोई कॉम्बो',
        descriptionEn: 'Onion, Tomato, Potato, Green Chilli & Coriander',
        sellingPrice: '149.00',
        regularCombinedPrice: '175.00',
        savingsAmount: '26.00',
        active: true,
        available: true,
        inStock: true,
        maxAvailableCombos: 2,
        items: [
          {
            vegetableId: 1,
            nameEn: 'Onion (Kanda)',
            baseUnit: 'KG',
            unitLabel: '1kg',
            quantityInBaseUnit: '1.000',
            currentPricePerUnit: '40.00',
            regularLinePrice: '40.00',
            inStock: true,
          },
          {
            vegetableId: 2,
            nameEn: 'Tomato',
            baseUnit: 'KG',
            unitLabel: '1kg',
            quantityInBaseUnit: '1.000',
            currentPricePerUnit: '50.00',
            regularLinePrice: '50.00',
            inStock: true,
          },
        ],
      }

      renderWithProviders(
        <div>
          <ShopCombosSection
            combos={[sampleCombo]}
            usualVegetables={[
              {
                id: 1,
                nameEn: 'Onion (Kanda)',
                category: 'Roots & Tubers',
                baseUnit: 'KG',
                pricePerUnit: '40.00',
                inStock: true,
                options: [],
              },
            ]}
          />
          <CartContents onCheckout={() => {}} />
        </div>,
      )

      const comboCard = screen.getByTestId('combo-card-501')
      expect(comboCard).toHaveTextContent('Daily Cooking Combo')
      expect(comboCard).toHaveTextContent('Matches your usual')
      expect(comboCard).toHaveTextContent('Save ₹26.00')
      expect(comboCard).toHaveTextContent('₹149.00')
      expect(comboCard).toHaveTextContent('₹175.00')

      // Add combo to cart
      const addComboBtn = screen.getByRole('button', { name: /add combo/i })
      fireEvent.click(addComboBtn)

      expect(useCartStore.getState().combos).toHaveLength(1)
      expect(useCartStore.getState().combos[0].count).toBe(1)

      // Increment once to reach maxAvailableCombos = 2
      const incBtns = screen.getAllByRole('button', { name: /increase/i })
      fireEvent.click(incBtns[0])
      expect(useCartStore.getState().combos[0].count).toBe(2)

      // At count=2 (== maxAvailableCombos), the Increase button is disabled
      expect(incBtns[0]).toBeDisabled()
    })
  })

  describe('Task 3 & 4: Saved & Recurring Baskets + Retention Helpers', () => {
    it('renders recurring basket reminder banner, warns on unavailable items, and loads available items into cart without auto-charging', async () => {
      const mockBaskets: SavedBasketDto[] = [
        {
          id: 901,
          name: 'Weekly Vegetable Basket',
          estimatedTotal: '85.00',
          totalItemsCount: 2,
          unavailableItems: ['Spinach (Palak)'],
          schedule: {
            id: 301,
            frequency: 'WEEKLY',
            preferredDayOfWeek: null,
            nextReminderDate: '2026-11-18',
            status: 'ACTIVE',
            reminderDue: true,
          },
          updatedAt: '2026-11-18T08:00:00',
          items: [
            {
              vegetableId: 1,
              nameEn: 'Onion (Kanda)',
              baseUnit: 'KG',
              unitId: 11,
              unitLabel: '1kg',
              quantityInBaseUnit: '1.000',
              count: 2,
              currentUnitPrice: '42.50',
              estimatedLineTotal: '85.00',
              availableStock: '10.000',
              availableToday: true,
            },
            {
              vegetableId: 5,
              nameEn: 'Spinach (Palak)',
              baseUnit: 'BUNCH',
              unitId: 55,
              unitLabel: '1 bunch',
              quantityInBaseUnit: '1.000',
              count: 1,
              currentUnitPrice: '20.00',
              estimatedLineTotal: '20.00',
              availableStock: '0.000',
              availableToday: false,
            },
          ],
        },
      ]

      server.use(
        http.get('*/api/my/baskets', () => HttpResponse.json(mockBaskets)),
      )

      renderWithProviders(<SavedBasketsSection />)

      await waitFor(() => {
        expect(
          screen.getByTestId('recurring-basket-reminder-banner'),
        ).toHaveTextContent('Weekly Vegetable Basket')
      })

      expect(screen.getByTestId('saved-basket-card-901')).toHaveTextContent(
        /unavailable today: spinach/i,
      )

      const loadBtn = screen.getByRole('button', { name: /load into cart/i })
      fireEvent.click(loadBtn)

      // Only the available item (Onion) is added to cart; Spinach (unavailable) is skipped
      const cartItems = useCartStore.getState().items
      expect(cartItems).toHaveLength(1)
      expect(cartItems[0].nameEn).toBe('Onion (Kanda)')
      expect(cartItems[0].count).toBe(2)
    })

    it('builds usual vegetables from non-cancelled order history and maps order items to cart', () => {
      const catalog = [
        {
          id: 1,
          nameEn: 'Tomato',
          category: 'Everyday Vegetables',
          baseUnit: 'KG' as const,
          pricePerUnit: '40.00',
          inStock: true,
          options: [
            { unitId: 10, label: '500g', quantityInBaseUnit: '0.500', price: '20.00', defaultOption: true },
          ],
        },
      ]

      const orders = [
        {
          id: 1,
          status: 'DELIVERED' as const,
          paymentMethod: 'COD' as const,
          deliveryDate: '2026-11-17',
          deliveryAddress: 'Pune',
          deliveryPincode: '411038',
          subtotal: '40.00',
          deliveryFee: '30.00',
          estimatedTotal: '70.00',
          finalTotal: '70.00',
          createdAt: '2026-11-17T10:00:00',
          items: [
            {
              vegetableId: 1,
              vegetableName: 'Tomato',
              quantity: '1.000',
              unitPrice: '40.00',
              estimatedLineTotal: '40.00',
              actualQuantity: '1.000',
              finalLineTotal: '40.00',
            },
          ],
        },
      ]

      const usuals = buildUsualVegetables(orders, catalog)
      expect(usuals).toHaveLength(1)
      expect(usuals[0].nameEn).toBe('Tomato')

      const mapped = mapOrderItemsToCart(orders[0].items, catalog)
      expect(mapped.matched).toHaveLength(1)
      expect(mapped.matched[0].count).toBe(2) // 1.000 kg / 0.500 kg option = 2 units
    })
  })
})
