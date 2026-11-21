import { lazy, Suspense, type ReactElement } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import { StaffLayout } from '@/components/layout/StaffLayout'
import { DeliveryLayout } from '@/components/layout/DeliveryLayout'
import { RouteGuard } from '@/components/RouteGuard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoader } from '@/components/PageLoader'

// Lazy-load pages by role area for code splitting
const LandingPage = lazy(() => import('@/features/landing/pages/LandingPage'))
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const SignupPage = lazy(() => import('@/features/auth/pages/SignupPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'))

// Customer
const ShopPage = lazy(() => import('@/features/catalog/pages/ShopPage'))
const CheckoutPage = lazy(() => import('@/features/orders/pages/CheckoutPage'))
const CustomerOrdersPage = lazy(() => import('@/features/orders/pages/CustomerOrdersPage'))
const CustomerOrderDetailPage = lazy(() => import('@/features/orders/pages/CustomerOrderDetailPage'))
const AccountPage = lazy(() => import('@/features/users/pages/AccountPage'))
const LoyaltyPage = lazy(() => import('@/features/loyalty/pages/LoyaltyPage'))

// Staff
const DashboardPage = lazy(() => import('@/features/report/pages/DashboardPage'))
const QuickSalePage = lazy(() => import('@/features/sales/pages/QuickSalePage'))
const StockPage = lazy(() => import('@/features/inventory/pages/StockPage'))
const InventoryInsightsPage = lazy(() => import('@/features/inventory/pages/InventoryInsightsPage'))
const StaffOrdersPage = lazy(() => import('@/features/orders/pages/StaffOrdersPage'))
const RiderOperationsPage = lazy(() => import('@/features/delivery/pages/RiderOperationsPage'))
const CatalogPage = lazy(() => import('@/features/catalog/pages/CatalogPage'))
const StaffCombosPage = lazy(() => import('@/features/combos/pages/StaffCombosPage'))
const CatalogImagesPage = lazy(() => import('@/features/catalog/pages/CatalogImagesPage'))
const VegetableFormPage = lazy(() => import('@/features/catalog/pages/VegetableFormPage'))
const CategoriesPage = lazy(() => import('@/features/catalog/pages/CategoriesPage'))
const SuppliersPage = lazy(() => import('@/features/purchase/pages/SuppliersPage'))
const SupplierDetailPage = lazy(() => import('@/features/purchase/pages/SupplierDetailPage'))
const PurchasesPage = lazy(() => import('@/features/purchase/pages/PurchasesPage'))
const NewPurchasePage = lazy(() => import('@/features/purchase/pages/NewPurchasePage'))
const PurchaseDetailPage = lazy(() => import('@/features/purchase/pages/PurchaseDetailPage'))
const PricingPage = lazy(() => import('@/features/pricing/pages/PricingPage'))
const PaymentsPage = lazy(() => import('@/features/payments/pages/PaymentsPage'))
const CashClosingPage = lazy(() => import('@/features/report/pages/CashClosingPage'))
const BusinessReportsPage = lazy(() => import('@/features/report/pages/BusinessReportsPage'))
const UsersPage = lazy(() => import('@/features/users/pages/UsersPage'))
const StoreSettingsPage = lazy(() => import('@/features/settings/pages/StoreSettingsPage'))
const NotificationLogsPage = lazy(
  () => import('@/features/notifications/pages/NotificationLogsPage'),
)
const RetentionMarketingPage = lazy(
  () => import('@/features/retention/pages/RetentionMarketingPage'),
)
const BackupsPage = lazy(() => import('@/features/backup/pages/BackupsPage'))

// Delivery
const DeliveryOrdersPage = lazy(() => import('@/features/delivery/pages/DeliveryOrdersPage'))

// Public display board
const ChalkboardPriceBoardPage = lazy(
  () => import('@/features/pricing/pages/ChalkboardPriceBoardPage'),
)

// Dev
const StyleGuidePage = lazy(() => import('@/pages/StyleGuidePage'))

const wrap = (el: ReactElement) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>{el}</Suspense>
  </ErrorBoundary>
)

export const router = createBrowserRouter([
  // Public auth routes
  {
    element: <PublicLayout />,
    children: [
      { path: '/login', element: wrap(<LoginPage />) },
      { path: '/signup', element: wrap(<SignupPage />) },
    ],
  },

  // Customer & public editorial storefront (`/` and `/shop` share CustomerLayout)
  {
    element: <CustomerLayout />,
    children: [
      { path: '/', element: wrap(<LandingPage />) },
      { path: '/shop', element: wrap(<ShopPage />) },
      {
        element: <RouteGuard requiredRoles={['CUSTOMER', 'OWNER', 'STAFF', 'DELIVERY']} />,
        children: [
          { path: '/shop/checkout', element: wrap(<CheckoutPage />) },
          { path: '/shop/orders', element: wrap(<CustomerOrdersPage />) },
          { path: '/shop/orders/:id', element: wrap(<CustomerOrderDetailPage />) },
          { path: '/shop/account', element: wrap(<AccountPage />) },
          { path: '/shop/rewards', element: wrap(<LoyaltyPage />) },
        ],
      },
    ],
  },

  // Staff routes
  {
    element: <RouteGuard requiredRoles={['OWNER', 'STAFF']} />,
    children: [
      {
        element: <StaffLayout />,
        children: [
          { path: '/staff', element: <Navigate to="/staff/sale" replace /> },
          { path: '/staff/sale', element: wrap(<QuickSalePage />) },
          { path: '/staff/orders', element: wrap(<StaffOrdersPage />) },
          { path: '/staff/riders', element: wrap(<RiderOperationsPage />) },
          { path: '/staff/stock', element: wrap(<StockPage />) },
          { path: '/staff/combos', element: wrap(<StaffCombosPage />) },
          { path: '/staff/catalog', element: wrap(<CatalogPage />) },
          { path: '/staff/catalog/new', element: wrap(<VegetableFormPage />) },
          { path: '/staff/catalog/:id', element: wrap(<VegetableFormPage />) },
          { path: '/staff/categories', element: wrap(<CategoriesPage />) },
          { path: '/staff/purchases', element: wrap(<PurchasesPage />) },
          { path: '/staff/purchases/new', element: wrap(<NewPurchasePage />) },
          // Owner-only (UX guard; server enforces)
          {
            element: <RouteGuard requiredRoles={['OWNER']} />,
            children: [
              { path: '/staff/dashboard', element: wrap(<DashboardPage />) },
              { path: '/staff/inventory-insights', element: wrap(<InventoryInsightsPage />) },
              { path: '/staff/suppliers', element: wrap(<SuppliersPage />) },
              { path: '/staff/suppliers/:id', element: wrap(<SupplierDetailPage />) },
              { path: '/staff/catalog/images', element: wrap(<CatalogImagesPage />) },
              { path: '/staff/pricing', element: wrap(<PricingPage />) },
              { path: '/staff/purchases/:id', element: wrap(<PurchaseDetailPage />) },
              { path: '/staff/payments', element: wrap(<PaymentsPage />) },
              { path: '/staff/cash-closing', element: wrap(<CashClosingPage />) },
              { path: '/staff/reports', element: wrap(<BusinessReportsPage />) },
              { path: '/staff/users', element: wrap(<UsersPage />) },
              { path: '/staff/settings', element: wrap(<StoreSettingsPage />) },
              { path: '/staff/notifications', element: wrap(<NotificationLogsPage />) },
              { path: '/staff/retention', element: wrap(<RetentionMarketingPage />) },
              { path: '/staff/backups', element: wrap(<BackupsPage />) },
            ],
          },
        ],
      },
    ],
  },

  // Delivery routes
  {
    element: <RouteGuard requiredRoles={['DELIVERY']} />,
    children: [
      {
        element: <DeliveryLayout />,
        children: [
          { path: '/delivery', element: wrap(<DeliveryOrdersPage />) },
        ],
      },
    ],
  },

  {
    path: '/display/prices',
    element: wrap(<ChalkboardPriceBoardPage />),
  },

  // Error pages
  { path: '/403', element: wrap(<ForbiddenPage />) },
  { path: '/404', element: wrap(<NotFoundPage />) },
  { path: '*', element: wrap(<NotFoundPage />) },

  // Dev
  ...(import.meta.env.DEV
    ? [{ path: '/dev/styleguide', element: wrap(<StyleGuidePage />) }]
    : []),
])
