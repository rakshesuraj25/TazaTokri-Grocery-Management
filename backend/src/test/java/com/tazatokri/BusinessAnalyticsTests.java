package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.report.BusinessAnalyticsService;
import com.tazatokri.report.BusinessAnalyticsService.BusinessAnalyticsReport;
import com.tazatokri.report.ReportController;
import com.tazatokri.sales.SaleItemRepository;
import com.tazatokri.sales.SalePaymentMethod;
import com.tazatokri.sales.SaleRepository;

class BusinessAnalyticsTests {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    private static Vegetable veg(long id, String nameEn) {
        Vegetable v = new Vegetable();
        try {
            Field f = Vegetable.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(v, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
        v.setNameEn(nameEn);
        v.setBaseUnit(UnitType.KG);
        v.setActive(true);
        return v;
    }

    private BusinessAnalyticsService buildService(Clock clock) {
        SaleRepository sales = proxy(SaleRepository.class, (p, m, a) -> switch (m.getName()) {
            case "summarizeByPayment" -> List.of(
                    proxy(SaleRepository.PaymentSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> SalePaymentMethod.CASH;
                        case "getBills" -> 4L;
                        case "getTotal" -> new BigDecimal("800.00");
                        default -> null;
                    }),
                    proxy(SaleRepository.PaymentSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> SalePaymentMethod.UPI;
                        case "getBills" -> 2L;
                        case "getTotal" -> new BigDecimal("400.00");
                        default -> null;
                    }));
            case "summarizeDailySalesBetween" -> List.of(
                    proxy(SaleRepository.DailySaleSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getDay" -> LocalDate.of(2026, 11, 20);
                        case "getBills" -> 6L;
                        case "getTotal" -> new BigDecimal("1200.00");
                        default -> null;
                    }));
            default -> List.of();
        });

        SaleItemRepository saleItems = proxy(SaleItemRepository.class, (p, m, a) -> {
            if ("topItems".equals(m.getName())) {
                return List.of(
                        proxy(SaleItemRepository.TopItem.class, (p2, m2, a2) -> switch (m2.getName()) {
                            case "getVegetableId" -> 1L;
                            case "getName" -> "Tomato";
                            case "getQty" -> new BigDecimal("10.000");
                            case "getRevenue" -> new BigDecimal("500.00");
                            default -> null;
                        }));
            }
            return List.of();
        });

        CustomerOrderRepository orders = proxy(CustomerOrderRepository.class, (p, m, a) -> switch (m.getName()) {
            case "summarizeByStatusBetween" -> List.of(
                    proxy(CustomerOrderRepository.StatusSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getStatus" -> OrderStatus.DELIVERED;
                        case "getCnt" -> 3L;
                        case "getTotal" -> new BigDecimal("900.00");
                        default -> null;
                    }),
                    proxy(CustomerOrderRepository.StatusSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getStatus" -> OrderStatus.CANCELLED;
                        case "getCnt" -> 1L;
                        case "getTotal" -> new BigDecimal("250.00"); // excluded from sales
                        default -> null;
                    }),
                    proxy(CustomerOrderRepository.StatusSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getStatus" -> OrderStatus.PENDING_PAYMENT;
                        case "getCnt" -> 1L;
                        case "getTotal" -> new BigDecimal("300.00"); // excluded from sales
                        default -> null;
                    }));
            case "summarizeDailyValidOrdersBetween" -> List.of(
                    proxy(CustomerOrderRepository.DailyOrderSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getDay" -> LocalDate.of(2026, 11, 21);
                        case "getCnt" -> 3L;
                        case "getTotal" -> new BigDecimal("900.00");
                        default -> null;
                    }));
            case "summarizeValidOrderItemsBetween" -> List.of(
                    proxy(CustomerOrderRepository.OrderItemSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getVegetableId" -> 1L;
                        case "getName" -> "Tomato";
                        case "getQty" -> new BigDecimal("6.000");
                        case "getRevenue" -> new BigDecimal("300.00");
                        default -> null;
                    }),
                    proxy(CustomerOrderRepository.OrderItemSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getVegetableId" -> 2L;
                        case "getName" -> "Onion";
                        case "getQty" -> new BigDecimal("5.000");
                        case "getRevenue" -> new BigDecimal("200.00");
                        default -> null;
                    }));
            default -> List.of();
        });

        PaymentRepository payments = proxy(PaymentRepository.class, (p, m, a) -> switch (m.getName()) {
            case "sumSuccessfulCollectionsByMethodBetween" -> List.of(
                    proxy(PaymentRepository.MethodTotal.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> PaymentMethod.CASH;
                        case "getBills" -> 2L;
                        case "getTotal" -> new BigDecimal("600.00");
                        default -> null;
                    }),
                    proxy(PaymentRepository.MethodTotal.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> PaymentMethod.RAZORPAY;
                        case "getBills" -> 1L;
                        case "getTotal" -> new BigDecimal("300.00");
                        default -> null;
                    }));
            case "sumCashSettledBetween" -> new BigDecimal("400.00");
            case "sumPendingCashTotal" -> new BigDecimal("200.00");
            case "sumSuccessfulRefundsByMethodBetween" ->
                a[0] == PaymentMethod.RAZORPAY ? new BigDecimal("100.00") : BigDecimal.ZERO;
            default -> null;
        });

        PurchaseRepository purchases = proxy(PurchaseRepository.class, (p, m, a) ->
                "totalSpendBetween".equals(m.getName()) ? new BigDecimal("1500.00") : BigDecimal.ZERO);

        VegetableRepository vegetables = proxy(VegetableRepository.class, (p, m, a) ->
                "findByActiveTrueOrderByNameEnAsc".equals(m.getName())
                        ? List.of(veg(1L, "Tomato"), veg(2L, "Onion"), veg(3L, "Spinach"))
                        : List.of());

        StockMovementRepository movements = proxy(StockMovementRepository.class, (p, m, a) -> {
            if ("stockForVegetables".equals(m.getName())) {
                return List.of(
                        proxy(StockMovementRepository.VegetableQty.class, (p2, m2, a2) -> switch (m2.getName()) {
                            case "getVegetableId" -> 1L;
                            case "getQty" -> new BigDecimal("12.000");
                            default -> null;
                        }),
                        proxy(StockMovementRepository.VegetableQty.class, (p2, m2, a2) -> switch (m2.getName()) {
                            case "getVegetableId" -> 2L;
                            case "getQty" -> new BigDecimal("3.000"); // low stock
                            default -> null;
                        }),
                        proxy(StockMovementRepository.VegetableQty.class, (p2, m2, a2) -> switch (m2.getName()) {
                            case "getVegetableId" -> 3L;
                            case "getQty" -> BigDecimal.ZERO; // out of stock + zero sales
                            default -> null;
                        }));
            }
            return List.of();
        });

        return new BusinessAnalyticsService(
                sales, saleItems, orders, payments, purchases, vegetables, movements, clock);
    }

    @Test
    void analyticsEndpointIsOwnerOnly() throws NoSuchMethodException {
        Method m = ReportController.class.getMethod("analytics", LocalDate.class, LocalDate.class);
        PreAuthorize ann = m.getAnnotation(PreAuthorize.class);
        assertNotNull(ann);
        assertEquals("hasRole('OWNER')", ann.value());
    }

    @Test
    void validatesDateRangeBounds() {
        Instant nowIst = ZonedDateTime.of(2026, 11, 21, 12, 0, 0, 0, IST).toInstant();
        BusinessAnalyticsService service = buildService(Clock.fixed(nowIst, IST));

        assertThrows(BadRequestException.class,
                () -> service.analytics(LocalDate.of(2026, 11, 22), LocalDate.of(2026, 11, 21)));
        assertThrows(BadRequestException.class,
                () -> service.analytics(LocalDate.of(2025, 1, 1), LocalDate.of(2026, 11, 21)));
    }

    @Test
    void aggregatesSalesPaymentsProductsOrdersAndInventoryWithoutDoubleCounting() {
        Instant nowIst = ZonedDateTime.of(2026, 11, 21, 12, 0, 0, 0, IST).toInstant();
        BusinessAnalyticsService service = buildService(Clock.fixed(nowIst, IST));

        BusinessAnalyticsReport r = service.analytics(
                LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 21));

        // Total sales = POS (800 + 400 = 1200) + Valid online (900) = 2100.00 (excludes CANCELLED 250 & PENDING_PAYMENT 300)
        assertEquals(new BigDecimal("2100.00"), r.totalSales());
        assertEquals(9L, r.totalOrders()); // 6 POS + 3 valid online
        assertEquals(1L, r.cancelledOrders());
        assertEquals(3L, r.deliveredOrders());
        assertEquals(1L, r.pendingOrders()); // PENDING_PAYMENT counted as pending

        // Cash collections = POS cash (800) + COD settled to shop (400) = 1200.00 (excludes unsettled 200)
        assertEquals(new BigDecimal("1200.00"), r.cashCollections());
        assertEquals(new BigDecimal("700.00"), r.upiDigitalCollections()); // 400 POS UPI + 300 Razorpay
        assertEquals(new BigDecimal("600.00"), r.codCollected());
        assertEquals(new BigDecimal("200.00"), r.codPendingSettlement());
        assertEquals(new BigDecimal("100.00"), r.totalRefunds());

        // Highest sales day = 2026-11-20 (1200.00)
        assertEquals(LocalDate.of(2026, 11, 20), r.highestSalesDay().date());
        assertEquals(new BigDecimal("1200.00"), r.highestSalesDay().totalSales());

        // Product analytics: Tomato (500 + 300 = 800, qty 16.000), Onion (200, qty 5.000), Spinach (zero sales)
        assertEquals("Tomato", r.bestSellingProduct().name());
        assertEquals(new BigDecimal("800.00"), r.bestSellingProduct().revenue());
        assertEquals(new BigDecimal("16.000"), r.bestSellingProduct().quantity());
        assertEquals(1, r.zeroSaleProducts().size());
        assertEquals("Spinach", r.zeroSaleProducts().get(0).name());

        // Inventory & purchase spend
        assertEquals(1L, r.lowStockCount());
        assertEquals(1L, r.outOfStockCount());
        assertEquals(new BigDecimal("1500.00"), r.purchaseSpend());
    }
}
