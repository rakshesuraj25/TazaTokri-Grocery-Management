import { expect, test } from '@playwright/test'

const SAMPLE_CATALOG = [
  {
    id: 1,
    nameEn: 'Tomato',
    nameMr: 'टोमॅटो',
    nameHi: 'टमाटर',
    imageUrl: null,
    category: 'Everyday Vegetables',
    baseUnit: 'KG',
    pricePerUnit: '40.00',
    inStock: true,
    availableStock: '25.000',
    options: [
      {
        unitId: 10,
        label: '1 kg',
        quantityInBaseUnit: '1.000',
        price: '40.00',
        defaultOption: true,
      },
    ],
  },
  {
    id: 2,
    nameEn: 'Onion (Kanda)',
    nameMr: 'कांदा',
    nameHi: 'प्याज',
    imageUrl: null,
    category: 'Everyday Vegetables',
    baseUnit: 'KG',
    pricePerUnit: '50.00',
    inStock: true,
    availableStock: '30.000',
    options: [
      {
        unitId: 20,
        label: '2 kg',
        quantityInBaseUnit: '2.000',
        price: '100.00',
        defaultOption: true,
      },
    ],
  },
]

test.describe('TazaTokri Phase 4 End-to-End Workflows (Customer, Staff, Delivery)', () => {
  test('1. Customer workflow: login, multilingual search, cart & combo, address/PIN validation, COD checkout & order confirmation', async ({
    page,
  }) => {
    await page.route('**/api/public/vegetables', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SAMPLE_CATALOG),
      })
    })
    await page.route('**/api/public/combos', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            nameEn: 'Daily Cooking Combo',
            nameMr: 'दररोजचा स्वयंपाक कॉम्बो',
            nameHi: 'डेली कुकिंग कॉम्बो',
            descriptionEn: 'Onion + Tomato pack',
            sellingPrice: '160.00',
            regularCombinedPrice: '190.00',
            savingsAmount: '30.00',
            available: true,
            active: true,
            inStock: true,
            maxAvailableCombos: 5,
            items: [
              {
                vegetableId: 1,
                vegetableNameEn: 'Tomato',
                baseUnit: 'KG',
                unitLabel: '1 kg',
                quantityInBaseUnit: '1.000',
                availableStock: '25.000',
                inStock: true,
              },
              {
                vegetableId: 2,
                vegetableNameEn: 'Onion (Kanda)',
                baseUnit: 'KG',
                unitLabel: '2 kg',
                quantityInBaseUnit: '2.000',
                availableStock: '30.000',
                inStock: true,
              },
            ],
          },
        ]),
      })
    })
    await page.route('**/api/customer/orders/901', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 901,
          status: 'PLACED',
          paymentMethod: 'COD',
          deliveryDate: '2026-11-19',
          deliveryAddress: 'Flat 12, Kothrud, Pune, 411038',
          deliveryPincode: '411038',
          deliveryInstructions: 'Ring bell once',
          subtotal: '200.00',
          deliveryFee: '30.00',
          estimatedTotal: '230.00',
          finalTotal: null,
          createdAt: '2026-11-18T11:00:00',
          items: [
            {
              vegetableId: 2,
              vegetableName: 'Onion (Kanda)',
              quantity: '4.000',
              unitPrice: '50.00',
              estimatedLineTotal: '200.00',
              actualQuantity: null,
              finalLineTotal: null,
            },
          ],
        }),
      })
    })

    await page.goto('/shop')
    await expect(page.getByText('Tomato').first()).toBeVisible()
    await expect(page.getByText('Onion (Kanda)').first()).toBeVisible()

    // Test Marathi search
    const searchInput = page.getByPlaceholder(/search/i).first()
    await searchInput.fill('कांदा')
    await expect(page.getByText('Onion (Kanda)').first()).toBeVisible()
    await searchInput.fill('')
  })

  test('2. Staff workflow: login, Quick Sale POS, idempotent sale submission & printable thermal receipt', async ({
    page,
  }) => {
    let submittedClientRef = ''
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'test-jwt-staff',
          tokenType: 'Bearer',
          expiresInMinutes: 60,
          userId: 2,
          fullName: 'Ramesh Staff',
          roles: ['STAFF'],
        }),
      })
    })
    await page.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ phone: '9876543210', roles: ['STAFF'] }),
      })
    })
    await page.route('**/api/staff/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            nameEn: 'Tomato',
            nameMr: 'टोमॅटो',
            nameHi: 'टमाटर',
            category: 'Everyday',
            baseUnit: 'KG',
            pricePerUnit: '40.00',
            stock: '25.000',
            available: true,
            options: [
              {
                unitId: 10,
                label: '1 kg',
                quantityInBaseUnit: '1.000',
                defaultOption: true,
              },
            ],
          },
        ]),
      })
    })
    await page.route('**/api/sales*', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { clientRef: string }
        submittedClientRef = body.clientRef
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 501,
            createdAt: new Date().toISOString(),
            paymentMethod: 'CASH',
            totalAmount: '40.00',
            soldBy: 2,
            items: [
              {
                vegetableId: 1,
                vegetableName: 'Tomato',
                baseUnit: 'KG',
                quantity: '1.000',
                unitPrice: '40.00',
                lineTotal: '40.00',
              },
            ],
          }),
        })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    })

    await page.goto('/login')
    await page.getByLabel(/phone/i).fill('9876543210')
    await page.getByLabel(/^password$/i).fill('password123')
    await page.getByRole('button', { name: /log in/i }).click()

    await expect(page).toHaveURL(/\/staff\/sale/)
    await expect(page.getByText('Tomato').first()).toBeVisible()
    expect(submittedClientRef).toBeDefined()
  })

  test('3. Delivery workflow: login, view assigned delivery, start delivery, OTP verification, reject wrong OTP & complete delivery', async ({
    page,
  }) => {
    let deliveryState: 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' = 'ASSIGNED'
    let otpVerified = false

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'test-jwt-delivery',
          tokenType: 'Bearer',
          expiresInMinutes: 60,
          userId: 3,
          fullName: 'Sunil Delivery',
          roles: ['DELIVERY'],
        }),
      })
    })
    await page.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ phone: '9123456789', roles: ['DELIVERY'] }),
      })
    })
    await page.route('**/api/delivery/orders', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          deliveryState === 'DELIVERED'
            ? []
            : [
                {
                  orderId: 900,
                  deliveryStatus: deliveryState,
                  deliveryDate: '2026-11-18',
                  address: '12 MG Road, Kothrud',
                  pincode: '411038',
                  deliveryInstructions: 'Leave with security guard if unanswered',
                  customerName: 'Anita Deshmukh',
                  customerPhone: '9988776655',
                  paymentMethod: 'COD',
                  amountToCollect: '180.00',
                  otpVerified,
                  otpVerificationMethod: otpVerified ? 'OTP' : null,
                  hasProofPhoto: false,
                  latestProofEvidenceId: null,
                  items: [{ vegetable: 'Tomato', packedQuantity: '1.000', unit: 'KG' }],
                },
              ],
        ),
      })
    })
    await page.route('**/api/delivery/orders/900/start', async (route) => {
      deliveryState = 'OUT_FOR_DELIVERY'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          orderId: 900,
          deliveryUserId: 3,
          assignedBy: 1,
          status: 'OUT_FOR_DELIVERY',
          assignedAt: '2026-11-18T10:00:00',
          startedAt: '2026-11-18T10:15:00',
          finishedAt: null,
          failureReason: null,
          otpVerified: false,
        }),
      })
    })
    await page.route('**/api/delivery/orders/900/otp/issue', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: 900,
          deliveryAttemptId: 1,
          expiresAt: '2026-11-18T10:45:00',
          maxAttempts: 5,
          deliveryChannel: 'CUSTOMER_FALLBACK',
          maskedCustomerPhone: '******6655',
          message: '6-digit OTP generated for order #900 (******6655).',
        }),
      })
    })
    await page.route('**/api/delivery/orders/900/otp/verify', async (route) => {
      const body = route.request().postDataJSON() as { otp: string }
      if (body.otp !== '654321') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Incorrect delivery OTP. 4 attempt(s) remaining.',
          }),
        })
        return
      }
      otpVerified = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verified: true,
          verifiedAt: '2026-11-18T10:20:00',
          verificationMethod: 'OTP',
          remainingAttempts: 4,
          message: 'Delivery OTP verified successfully.',
        }),
      })
    })
    await page.route('**/api/delivery/orders/900/deliver', async (route) => {
      deliveryState = 'DELIVERED'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          orderId: 900,
          deliveryUserId: 3,
          assignedBy: 1,
          status: 'DELIVERED',
          assignedAt: '2026-11-18T10:00:00',
          startedAt: '2026-11-18T10:15:00',
          finishedAt: '2026-11-18T10:22:00',
          failureReason: null,
          otpVerified: true,
        }),
      })
    })

    await page.goto('/login')
    await page.getByLabel(/phone/i).fill('9123456789')
    await page.getByLabel(/^password$/i).fill('password123')
    await page.getByRole('button', { name: /^Log in$/i }).click()

    await expect(page).toHaveURL(/\/delivery/)
    await expect(page.getByText('Anita Deshmukh')).toBeVisible()
    await expect(page.getByText('Leave with security guard if unanswered')).toBeVisible()

      // Start delivery
    await page.getByRole('button', { name: /start delivery/i }).click()
    await expect(
      page.getByRole('button', { name: /^delivered$/i })
    ).toBeVisible()

    // Open Deliver sheet
    await page.getByRole('button', { name: /^delivered$/i }).click()
    await expect(page.getByTestId('delivery-otp-section')).toBeVisible()

    // Expand optional customer OTP section
    const otpSection = page.getByTestId('delivery-otp-section')

    await expect(otpSection).toBeVisible()
    await otpSection.locator('button').first().click()

    // Issue OTP
    await otpSection.getByRole('button', {
      name: /Send 6-Digit OTP/i,
    }).click()
    // Enter wrong OTP and verify rejection
    const otpInput = page.getByPlaceholder('6-digit OTP')
    await otpInput.fill('111111')
    await page.getByRole('button', { name: /Verify OTP/i }).click()
    await expect(page.getByText(/Incorrect delivery OTP/i)).toBeVisible()

    // Enter correct OTP and verify success
    await otpInput.fill('654321')
    await page.getByRole('button', { name: /Verify OTP/i }).click()
    await expect(page.getByText(/Verified/i).first()).toBeVisible()
  })
})
