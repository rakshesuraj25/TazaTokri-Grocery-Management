package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.inventory.InventoryInsightsService;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.purchase.Purchase;
import com.tazatokri.purchase.PurchaseItemRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.purchase.PurchaseStatus;
import com.tazatokri.purchase.Supplier;
import com.tazatokri.purchase.SupplierPaymentRepository;
import com.tazatokri.purchase.SupplierRepository;
import com.tazatokri.purchase.SupplierService;
import com.tazatokri.report.BusinessAnalyticsService;
import com.tazatokri.report.BusinessOverviewService;
import com.tazatokri.report.ReportController;
import com.tazatokri.sales.SaleItemRepository;
import com.tazatokri.sales.SalePaymentMethod;
import com.tazatokri.sales.SaleRepository;
import com.tazatokri.user.UserRepository;

class BusinessOverviewTests {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-11-21T10:00:00Z"), IST);

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    @Test
    void aggregatesOverviewKpisOrdersFinancialsAlertsTopProductsAndIstBoundaries() throws Exception {
        LocalDate today = LocalDate.of(2026, 11, 21);
        LocalDateTime todayStart = today.atStartOfDay();

        Vegetable tomato = new Vegetable();
        tomato.setId(1L);
        tomato.setNameEn("Tomato");
        tomato.setBaseUnit(UnitType.KG);
        tomato.setActive(true);

        SaleRepository saleRepo = proxy(SaleRepository.class, (p, m, a) -> switch (m.getName()) {
            case "summarizeByPayment" -> {
                LocalDateTime from = (LocalDateTime) a[0];
                if (from.equals(todayStart)) {
                    yield List.of(proxy(SaleRepository.PaymentSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> SalePaymentMethod.CASH;
                        case "getBills" -> 2L;
                        case "getTotal" -> new BigDecimal("600.00");
                        default -> null;
                    }));
                }
                yield List.of(proxy(SaleRepository.PaymentSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                    case "getMethod" -> SalePaymentMethod.CASH;
                    case "getBills" -> 1L;
                    case "getTotal" -> new BigDecimal("400.00");
                    default -> null;
                }));
            }
            case "summarizeDailySalesBetween" -> List.of();
            case "totalItemsSoldBetween" -> new BigDecimal("15.000");
            default -> throw new UnsupportedOperationException("SaleRepository." + m.getName());
        });

        SaleItemRepository saleItemRepo = proxy(SaleItemRepository.class, (p, m, a) -> switch (m.getName()) {
            case "topItems" -> List.of(new SaleItemRepository.TopItem() {
                @Override public Long getVegetableId() { return 1L; }
                @Override public String getName() { return "Tomato"; }
                @Override public BigDecimal getQty() { return new BigDecimal("15.000"); }
                @Override public BigDecimal getRevenue() { return new BigDecimal("600.00"); }
            });
            case "summarizeShopSalesBetween" -> List.of();
            default -> throw new UnsupportedOperationException("SaleItemRepository." + m.getName());
        });

        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findValidOrdersBetween" -> List.of();
            case "summarizeByStatusBetween" -> List.of(
                    statusRow(OrderStatus.PLACED, 2L, "500.00"),
                    statusRow(OrderStatus.CONFIRMED, 1L, "250.00"),
                    statusRow(OrderStatus.PACKED, 1L, "200.00"),
                    statusRow(OrderStatus.OUT_FOR_DELIVERY, 1L, "300.00"),
                    statusRow(OrderStatus.DELIVERED, 3L, "900.00"),
                    statusRow(OrderStatus.CANCELLED, 1L, "150.00")
            );
            case "summarizeDailyValidOrdersBetween", "summarizeValidOrderItemsBetween",
                 "summarizeValidOrderDemandBetween" -> List.of();
            default -> throw new UnsupportedOperationException("CustomerOrderRepository." + m.getName());
        });

        PaymentRepository paymentRepo = proxy(PaymentRepository.class, (p, m, a) -> switch (m.getName()) {
            case "sumSuccessfulCollectionsByMethodBetween" -> List.of(
                    proxy(PaymentRepository.MethodTotal.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> PaymentMethod.RAZORPAY;
                        case "getBills" -> 1L;
                        case "getTotal" -> new BigDecimal("500.00");
                        default -> null;
                    }),
                    proxy(PaymentRepository.MethodTotal.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> PaymentMethod.CASH;
                        case "getBills" -> 2L;
                        case "getTotal" -> new BigDecimal("400.00");
                        default -> null;
                    }));
            case "sumCashSettledBetween" -> new BigDecimal("250.00");
            case "sumPendingCashTotal" -> new BigDecimal("150.00");
            case "sumSuccessfulRefundsByMethodBetween" -> BigDecimal.ZERO;
            default -> throw new UnsupportedOperationException("PaymentRepository." + m.getName());
        });

        PurchaseRepository purchaseRepo = proxy(PurchaseRepository.class, (p, m, a) -> switch (m.getName()) {
            case "totalSpendBetween" -> BigDecimal.ZERO;
            case "findTop3ByOrderByPurchaseDateDescIdDesc" -> List.of();
            case "summarizeAllSupplierPurchases" -> List.of(new PurchaseRepository.SupplierPurchaseProjection() {
                @Override public Long getSupplierId() { return 1L; }
                @Override public long getPurchaseCount() { return 2L; }
                @Override public BigDecimal getTotalPurchases() { return new BigDecimal("1000.00"); }
                @Override public LocalDate getLastPurchaseDate() { return today; }
            });
            default -> throw new UnsupportedOperationException("PurchaseRepository." + m.getName());
        });

        SupplierPaymentRepository supplierPayRepo = proxy(SupplierPaymentRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findAll" -> new PageImpl<>(List.of());
            case "summarizeAllSupplierPayments" -> List.of(new SupplierPaymentRepository.SupplierPaidProjection() {
                @Override public Long getSupplierId() { return 1L; }
                @Override public BigDecimal getTotalPaid() { return new BigDecimal("350.00"); }
            });
            default -> throw new UnsupportedOperationException("SupplierPaymentRepository." + m.getName());
        });

        SupplierRepository supplierRepo = proxy(SupplierRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findAll" -> List.of(new com.tazatokri.purchase.Supplier() {{ setId(1L); setName("Mandi"); setActive(true); }});
            default -> throw new UnsupportedOperationException(m.getName());
        });

        VegetableRepository vegRepo = proxy(VegetableRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByActiveTrueOrderByNameEnAsc" -> List.of(tomato);
            default -> throw new UnsupportedOperationException(m.getName());
        });

        StockMovementRepository movRepo = proxy(StockMovementRepository.class, (p, m, a) -> switch (m.getName()) {
            case "stockOfActiveVegetables", "stockForVegetables" -> List.of(new StockMovementRepository.VegetableQty() {
                @Override public Long getVegetableId() { return 1L; }
                @Override public String getName() { return "Tomato"; }
                @Override public BigDecimal getQty() { return BigDecimal.ZERO; }
            });
            case "wastageBetween" -> List.of();
            case "findAll" -> new PageImpl<>(List.of());
            default -> throw new UnsupportedOperationException("StockMovementRepository." + m.getName());
        });

        PurchaseItemRepository purItemRepo = proxy(PurchaseItemRepository.class, (p, m, a) -> switch (m.getName()) {
            case "summarizeForVegetables" -> List.of();
            default -> throw new UnsupportedOperationException(m.getName());
        });

        BusinessAnalyticsService analyticsService = new BusinessAnalyticsService(
                saleRepo, saleItemRepo, orderRepo, paymentRepo, purchaseRepo, vegRepo, movRepo, FIXED_CLOCK);
        InventoryInsightsService insightsService = new InventoryInsightsService(
                vegRepo, movRepo, orderRepo, saleItemRepo, purItemRepo, FIXED_CLOCK);
        SupplierService supplierService = new SupplierService(
                supplierRepo, purchaseRepo, supplierPayRepo,
                proxy(UserRepository.class, (p, m, a) -> null));

        BusinessOverviewService overviewService = new BusinessOverviewService(
                analyticsService, insightsService, supplierService,
                orderRepo, vegRepo, purchaseRepo, movRepo, supplierPayRepo, FIXED_CLOCK);

        BusinessOverviewService.BusinessOverviewResponse res = overviewService.overview();

        // KPIs & comparison (today = 600 POS + 2150 online = 2750; yesterday = 400 POS + 2150 online = 2550)
        assertEquals(today, res.kpis().date());
        assertEquals(new BigDecimal("2750.00"), res.kpis().todaySales());
        assertEquals(new BigDecimal("2550.00"), res.kpis().yesterdaySales());
        assertEquals(new BigDecimal("200.00"), res.kpis().salesChangeAmount());
        assertEquals(new BigDecimal("7.8"), res.kpis().salesChangePercent());

        // Order status counts
        assertEquals(2L, res.orderStatus().pendingConfirmation());
        assertEquals(1L, res.orderStatus().confirmed());
        assertEquals(1L, res.orderStatus().preparing());
        assertEquals(1L, res.orderStatus().outForDelivery());
        assertEquals(3L, res.orderStatus().delivered());
        assertEquals(1L, res.orderStatus().cancelled());

        // Financials (cashCollections = 600 POS + 250 COD settled = 850; 150 pending COD separate)
        assertEquals(new BigDecimal("850.00"), res.financials().todayCashSales());
        assertEquals(new BigDecimal("500.00"), res.financials().todayDigitalSales());
        assertEquals(new BigDecimal("400.00"), res.financials().codCollected());
        assertEquals(new BigDecimal("250.00"), res.financials().codSettledToShop());
        assertEquals(new BigDecimal("150.00"), res.financials().codPendingSettlement());
        assertEquals(new BigDecimal("650.00"), res.financials().supplierOutstandingPayable());

        // Top selling today with unit
        assertEquals(1, res.topSellingToday().size());
        assertEquals("Tomato", res.topSellingToday().get(0).name());
        assertEquals("KG", res.topSellingToday().get(0).unit());
        assertEquals(new BigDecimal("15.000"), res.topSellingToday().get(0).quantitySold());

        // Inventory alert (Tomato has 0 stock -> OUT_OF_STOCK)
        assertEquals(1, res.inventoryAlerts().size());
        assertEquals("OUT_OF_STOCK", res.inventoryAlerts().get(0).alertType());

        // OWNER authorization check
        Method overviewMethod = ReportController.class.getMethod("overview");
        assertNotNull(overviewMethod.getAnnotation(PreAuthorize.class));
        assertEquals("hasRole('OWNER')", overviewMethod.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void omitsPercentChangeWhenYesterdaySalesIsZero() {
        SaleRepository saleRepo = proxy(SaleRepository.class, (p, m, a) -> switch (m.getName()) {
            case "summarizeByPayment", "summarizeDailySalesBetween" -> List.of();
            case "totalItemsSoldBetween" -> BigDecimal.ZERO;
            default -> throw new UnsupportedOperationException(m.getName());
        });
        SaleItemRepository saleItemRepo = proxy(SaleItemRepository.class, (p, m, a) -> List.of());
        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> List.of());
        PaymentRepository paymentRepo = proxy(PaymentRepository.class, (p, m, a) -> switch (m.getName()) {
            case "sumCashSettledBetween", "sumPendingCashTotal", "sumSuccessfulRefundsByMethodBetween" -> BigDecimal.ZERO;
            default -> List.of();
        });
        PurchaseRepository purchaseRepo = proxy(PurchaseRepository.class, (p, m, a) -> switch (m.getName()) {
            case "totalSpendBetween" -> BigDecimal.ZERO;
            case "findTop3ByOrderByPurchaseDateDescIdDesc" -> List.of();
            default -> List.of();
        });
        SupplierPaymentRepository supplierPayRepo = proxy(SupplierPaymentRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findAll" -> new PageImpl<>(List.of());
            default -> List.of();
        });
        SupplierRepository supplierRepo = proxy(SupplierRepository.class, (p, m, a) -> List.of());
        VegetableRepository vegRepo = proxy(VegetableRepository.class, (p, m, a) -> List.of());
        StockMovementRepository movRepo = proxy(StockMovementRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findAll" -> new PageImpl<>(List.of());
            default -> List.of();
        });
        PurchaseItemRepository purItemRepo = proxy(PurchaseItemRepository.class, (p, m, a) -> List.of());

        BusinessOverviewService service = new BusinessOverviewService(
                new BusinessAnalyticsService(saleRepo, saleItemRepo, orderRepo, paymentRepo, purchaseRepo, vegRepo, movRepo, FIXED_CLOCK),
                new InventoryInsightsService(vegRepo, movRepo, orderRepo, saleItemRepo, purItemRepo, FIXED_CLOCK),
                new SupplierService(supplierRepo, purchaseRepo, supplierPayRepo, proxy(UserRepository.class, (p, m, a) -> null)),
                orderRepo, vegRepo, purchaseRepo, movRepo, supplierPayRepo, FIXED_CLOCK);

        BusinessOverviewService.BusinessOverviewResponse res = service.overview();
        assertNull(res.kpis().salesChangePercent());
        assertTrue(res.topSellingToday().isEmpty());
    }

    @Test
    void overviewLoadsRecentPurchasesViaLightweightSupplierGraphWithoutPaginatedCollectionFetch() throws Exception {
        Method top3Method = PurchaseRepository.class.getMethod("findTop3ByOrderByPurchaseDateDescIdDesc");
        org.springframework.data.jpa.repository.EntityGraph top3Graph =
                top3Method.getAnnotation(org.springframework.data.jpa.repository.EntityGraph.class);
        assertNotNull(top3Graph);
        assertEquals(List.of("supplier"), List.of(top3Graph.attributePaths()));

        Method pagedMethod = PurchaseRepository.class.getMethod(
                "findAllByOrderByPurchaseDateDescIdDesc", org.springframework.data.domain.Pageable.class);
        assertNotNull(pagedMethod);

        Supplier supplier = new Supplier();
        supplier.setId(7L);
        supplier.setName("Sahyadri Farms");

        Purchase p1 = new Purchase();
        p1.setId(42L);
        p1.setSupplier(supplier);
        p1.setPurchaseDate(LocalDate.of(2026, 11, 21));
        p1.setStatus(PurchaseStatus.COMPLETED);
        p1.setTotalCost(new BigDecimal("1250.5"));
        p1.setCreatedAt(LocalDateTime.of(2026, 11, 21, 9, 30));

        SaleRepository saleRepo = proxy(SaleRepository.class, (p, m, a) -> switch (m.getName()) {
            case "summarizeByPayment", "summarizeDailySalesBetween" -> List.of();
            case "totalItemsSoldBetween" -> BigDecimal.ZERO;
            default -> throw new UnsupportedOperationException(m.getName());
        });
        SaleItemRepository saleItemRepo = proxy(SaleItemRepository.class, (p, m, a) -> List.of());
        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> List.of());
        PaymentRepository paymentRepo = proxy(PaymentRepository.class, (p, m, a) -> switch (m.getName()) {
            case "sumCashSettledBetween", "sumPendingCashTotal", "sumSuccessfulRefundsByMethodBetween" -> BigDecimal.ZERO;
            default -> List.of();
        });
        PurchaseRepository purchaseRepo = proxy(PurchaseRepository.class, (p, m, a) -> switch (m.getName()) {
            case "totalSpendBetween" -> BigDecimal.ZERO;
            case "findTop3ByOrderByPurchaseDateDescIdDesc" -> List.of(p1);
            case "findAllByOrderByPurchaseDateDescIdDesc" ->
                    throw new AssertionError("Dashboard overview must not call paginated collection fetch");
            default -> List.of();
        });
        SupplierPaymentRepository supplierPayRepo = proxy(SupplierPaymentRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findAll" -> new PageImpl<>(List.of());
            default -> List.of();
        });
        SupplierRepository supplierRepo = proxy(SupplierRepository.class, (p, m, a) -> List.of());
        VegetableRepository vegRepo = proxy(VegetableRepository.class, (p, m, a) -> List.of());
        StockMovementRepository movRepo = proxy(StockMovementRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findAll" -> new PageImpl<>(List.of());
            default -> List.of();
        });
        PurchaseItemRepository purItemRepo = proxy(PurchaseItemRepository.class, (p, m, a) -> List.of());

        BusinessOverviewService service = new BusinessOverviewService(
                new BusinessAnalyticsService(saleRepo, saleItemRepo, orderRepo, paymentRepo, purchaseRepo, vegRepo, movRepo, FIXED_CLOCK),
                new InventoryInsightsService(vegRepo, movRepo, orderRepo, saleItemRepo, purItemRepo, FIXED_CLOCK),
                new SupplierService(supplierRepo, purchaseRepo, supplierPayRepo, proxy(UserRepository.class, (p, m, a) -> null)),
                orderRepo, vegRepo, purchaseRepo, movRepo, supplierPayRepo, FIXED_CLOCK);

        BusinessOverviewService.BusinessOverviewResponse res = service.overview();
        assertEquals(1, res.recentActivity().size());
        BusinessOverviewService.RecentActivityItem item = res.recentActivity().get(0);
        assertEquals("PURCHASE", item.type());
        assertEquals("Purchase #42 (Sahyadri Farms)", item.title());
        assertEquals("COMPLETED", item.subtitle());
        assertEquals(new BigDecimal("1250.50"), item.amount());
        assertEquals("/staff/purchases/42", item.link());
    }

    private static CustomerOrderRepository.StatusSummary statusRow(OrderStatus status, long cnt, String total) {
        return new CustomerOrderRepository.StatusSummary() {
            @Override public OrderStatus getStatus() { return status; }
            @Override public Long getCnt() { return cnt; }
            @Override public BigDecimal getTotal() { return new BigDecimal(total); }
        };
    }
}
