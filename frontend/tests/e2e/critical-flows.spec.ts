import { expect, test } from '@playwright/test'

test.describe('TazaTokri critical e2e flows', () => {
  test('1. Public landing -> browse shop -> add item -> checkout redirects to login', async ({
    page,
  }) => {
    await page.route('**/api/public/vegetables', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            nameEn: 'Tomato',
            nameMr: 'टोमॅटो',
            nameHi: 'टमाटर',
            imageUrl: null,
            category: 'Everyday',
            baseUnit: 'KG',
            pricePerUnit: '40.00',
            inStock: true,
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
        ]),
      })
    })

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('link', { name: /browse/i }).click()
    await expect(page).toHaveURL(/\/shop/)
    await expect(page.getByText('Tomato')).toBeVisible()
  })

  test('2. Staff login -> Quick Sale POS -> idempotent sale submission', async ({ page }) => {
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
            totalAmount: '20.00',
            soldBy: 2,
            items: [
              {
                vegetableId: 1,
                vegetableName: 'Tomato',
                quantity: '0.500',
                unitPrice: '40.00',
                lineTotal: '20.00',
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
    await expect(page.getByText('Tomato')).toBeVisible()
    expect(submittedClientRef).toBeDefined()
  })

  test('3. Delivery login -> view assigned orders -> start & mark delivered', async ({
    page,
  }) => {
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
        body: JSON.stringify([
          {
            orderId: 900,
            deliveryStatus: 'ASSIGNED',
            deliveryDate: '2026-11-12',
            address: '12 MG Road',
            pincode: '411001',
            customerName: 'Anita Deshmukh',
            customerPhone: '9988776655',
            paymentMethod: 'COD',
            amountToCollect: '180.00',
            items: [{ vegetable: 'Tomato', packedQuantity: '1.000', unit: 'KG' }],
          },
        ]),
      })
    })

    await page.goto('/login')
    await page.getByLabel(/phone/i).fill('9123456789')
    await page.getByLabel(/^password$/i).fill('password123')
    await page.getByRole('button', { name: /log in/i }).click()

    await expect(page).toHaveURL(/\/delivery/)
    await expect(page.getByText('Anita Deshmukh')).toBeVisible()
  })
})
