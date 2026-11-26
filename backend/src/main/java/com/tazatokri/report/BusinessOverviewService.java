package com.tazatokri.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.inventory.InventoryInsightsService;
import com.tazatokri.inventory.StockMovement;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.inventory.StockoutRisk;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.purchase.Purchase;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.purchase.SupplierPayment;
import com.tazatokri.purchase.SupplierPaymentRepository;
import com.tazatokri.purchase.SupplierService;

@Service
public class BusinessOverviewService {

    private static final BigDecimal LOW_STOCK_THRESHOLD = new BigDecimal("5");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    public record KpiOverview(
            LocalDate date,
            BigDecimal todaySales,
            BigDecimal yesterdaySales,
            BigDecimal salesChangeAmount,
            BigDecimal salesChangePercent,
            long todayOrders,
            long pendingOrders,
            long completedOrders,
            long cancelledOrders,
            BigDecimal averageOrderValue) {}

    public record OrderStatusOverview(
            long pendingConfirmation,
            long confirmed,
            long preparing,
            long outForDelivery,
            long delivered,
            long cancelled) {}

    public record InventoryAlertItem(
            Long vegetableId,
            String name,
            String unit,
            BigDecimal currentStock,
            String alertType,
            BigDecimal daysRemaining,
            BigDecimal suggestedPurchaseQty) {}

    public record TopSellingProduct(
            Long vegetableId,
            String name,
            String unit,
            BigDecimal quantitySold,
            BigDecimal revenue) {}

    public record FinancialOverview(
            BigDecimal todayCashSales,
            BigDecimal todayDigitalSales,
            BigDecimal codCollected,
            BigDecimal codSettledToShop,
            BigDecimal codPendingSettlement,
            BigDecimal supplierOutstandingPayable) {}

    public record RecentActivityItem(
            String type,
            String title,
            String subtitle,
            BigDecimal amount,
            LocalDateTime timestamp,
            String link) {}

    public record BusinessOverviewResponse(
            KpiOverview kpis,
            OrderStatusOverview orderStatus,
            List<InventoryAlertItem> inventoryAlerts,
            List<TopSellingProduct> topSellingToday,
            FinancialOverview financials,
            List<RecentActivityItem> recentActivity) {}

    private final BusinessAnalyticsService analyticsService;
    private final InventoryInsightsService insightsService;
    private final SupplierService supplierService;
    private final CustomerOrderRepository orders;
    private final VegetableRepository vegetables;
    private final PurchaseRepository purchases;
    private final StockMovementRepository movements;
    private final SupplierPaymentRepository supplierPayments;
    private final Clock clock;

    public BusinessOverviewService(
            BusinessAnalyticsService analyticsService,
            InventoryInsightsService insightsService,
            SupplierService supplierService,
            CustomerOrderRepository orders,
            VegetableRepository vegetables,
            PurchaseRepository purchases,
            StockMovementRepository movements,
            SupplierPaymentRepository supplierPayments,
            Clock clock) {
        this.analyticsService = analyticsService;
        this.insightsService = insightsService;
        this.supplierService = supplierService;
        this.orders = orders;
        this.vegetables = vegetables;
        this.purchases = purchases;
        this.movements = movements;
        this.supplierPayments = supplierPayments;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public BusinessOverviewResponse overview() {
        LocalDate today = LocalDate.now(clock);
        LocalDate yesterday = today.minusDays(1);
        LocalDateTime from = today.atStartOfDay();
        LocalDateTime to = today.plusDays(1).atStartOfDay();

        BusinessAnalyticsService.BusinessAnalyticsReport todayReport = analyticsService.analytics(today, today);
        BusinessAnalyticsService.BusinessAnalyticsReport yesterdayReport = analyticsService.analytics(yesterday, yesterday);

        BigDecimal todaySales = scale(todayReport.totalSales());
        BigDecimal yesterdaySales = scale(yesterdayReport.totalSales());
        BigDecimal salesChangeAmount = todaySales.subtract(yesterdaySales).setScale(2, RoundingMode.HALF_UP);
        BigDecimal salesChangePercent = yesterdaySales.signum() > 0
                ? salesChangeAmount.multiply(HUNDRED).divide(yesterdaySales, 1, RoundingMode.HALF_UP)
                : null;

        KpiOverview kpis = new KpiOverview(
                today,
                todaySales,
                yesterdaySales,
                salesChangeAmount,
                salesChangePercent,
                todayReport.totalOrders(),
                todayReport.pendingOrders(),
                todayReport.completedOrders(),
                todayReport.cancelledOrders(),
                scale(todayReport.averageOrderValue()));

        // Order status counts for today (IST)
        Map<OrderStatus, Long> statusCounts = new HashMap<>();
        for (CustomerOrderRepository.StatusSummary row : orders.summarizeByStatusBetween(from, to)) {
            statusCounts.put(row.getStatus(), row.getCnt() != null ? row.getCnt() : 0L);
        }
        OrderStatusOverview orderStatus = new OrderStatusOverview(
                statusCounts.getOrDefault(OrderStatus.PLACED, 0L),
                statusCounts.getOrDefault(OrderStatus.CONFIRMED, 0L),
                statusCounts.getOrDefault(OrderStatus.PACKED, 0L),
                statusCounts.getOrDefault(OrderStatus.OUT_FOR_DELIVERY, 0L),
                statusCounts.getOrDefault(OrderStatus.DELIVERED, 0L),
                statusCounts.getOrDefault(OrderStatus.CANCELLED, 0L));

        // Unit lookup for active vegetables
        Map<Long, String> unitByVegId = new HashMap<>();
        for (Vegetable v : vegetables.findByActiveTrueOrderByNameEnAsc()) {
            unitByVegId.put(v.getId(), v.getBaseUnit() != null ? v.getBaseUnit().name() : "KG");
        }

        // Inventory alerts from InventoryInsightsService
        InventoryInsightsService.InventoryInsightsDashboard insights = insightsService.getDashboard(7);
        List<InventoryAlertItem> alerts = new ArrayList<>();
        for (InventoryInsightsService.ProductDemandInsight p : insights.products()) {
            BigDecimal stock = p.currentStock() != null ? p.currentStock() : BigDecimal.ZERO;
            String alertType = null;
            if (stock.signum() <= 0) {
                alertType = "OUT_OF_STOCK";
            } else if (p.stockoutRisk() == StockoutRisk.CRITICAL) {
                alertType = "CRITICAL_RISK";
            } else if (p.stockoutRisk() == StockoutRisk.HIGH) {
                alertType = "HIGH_RISK";
            } else if (stock.compareTo(LOW_STOCK_THRESHOLD) <= 0) {
                alertType = "LOW_STOCK";
            }
            if (alertType != null) {
                alerts.add(new InventoryAlertItem(
                        p.vegetableId(),
                        p.name(),
                        p.unit(),
                        stock,
                        alertType,
                        p.daysRemaining(),
                        p.suggestedPurchaseQty()));
            }
        }
        alerts.sort(Comparator.comparingInt(BusinessOverviewService::alertPriority)
                .thenComparing(InventoryAlertItem::currentStock));
        if (alerts.size() > 10) {
            alerts = alerts.subList(0, 10);
        }

        // Top 5 selling products today by quantity sold
        List<TopSellingProduct> topSellingToday = todayReport.topProducts().stream()
                .sorted(Comparator.comparing(BusinessAnalyticsService.ProductSaleLine::quantity).reversed())
                .limit(5)
                .map(p -> new TopSellingProduct(
                        p.vegetableId(),
                        p.name(),
                        unitByVegId.getOrDefault(p.vegetableId(), "KG"),
                        p.quantity(),
                        scale(p.revenue())))
                .toList();

        // Financial overview (strictly separating sales, collected cash, pending COD, and supplier payable)
        BigDecimal supplierPayable = scale(supplierService.getDashboard(null, null).totalOutstandingPayable());
        FinancialOverview financials = new FinancialOverview(
                scale(todayReport.cashCollections()),
                scale(todayReport.upiDigitalCollections()),
                scale(todayReport.codCollected()),
                scale(todayReport.codSettledToShop()),
                scale(todayReport.codPendingSettlement()),
                supplierPayable);

        // Compact recent activity feed
        List<RecentActivityItem> activity = buildRecentActivity(today);

        return new BusinessOverviewResponse(
                kpis,
                orderStatus,
                alerts,
                topSellingToday,
                financials,
                activity);
    }

    private List<RecentActivityItem> buildRecentActivity(LocalDate today) {
        List<RecentActivityItem> items = new ArrayList<>();

        List<CustomerOrder> recentOrders = orders.findValidOrdersBetween(
                today.minusDays(2).atStartOfDay(), today.plusDays(1).atStartOfDay());
        for (int i = 0; i < Math.min(3, recentOrders.size()); i++) {
            CustomerOrder o = recentOrders.get(i);
            items.add(new RecentActivityItem(
                    "ORDER",
                    "Order #" + o.getId(),
                    o.getStatus().name().replace('_', ' '),
                    scale(o.getFinalTotal() != null ? o.getFinalTotal() : o.getEstimatedTotal()),
                    o.getCreatedAt(),
                    "/staff/orders/" + o.getId()));
        }

        List<Purchase> recentPurchases = purchases.findTop3ByOrderByPurchaseDateDescIdDesc();
        for (Purchase p : recentPurchases) {
            items.add(new RecentActivityItem(
                    "PURCHASE",
                    "Purchase #" + p.getId() + " (" + p.getSupplier().getName() + ")",
                    p.getStatus().name(),
                    scale(p.getTotalCost()),
                    p.getCreatedAt(),
                    "/staff/purchases/" + p.getId()));
        }

        List<StockMovement> recentMovements = movements
                .findAll(PageRequest.of(0, 3, Sort.by(Sort.Direction.DESC, "id"))).getContent();
        for (StockMovement m : recentMovements) {
            items.add(new RecentActivityItem(
                    "STOCK",
                    m.getVegetable().getNameEn() + " (" + m.getType().name() + ")",
                    m.getQuantity().toPlainString() + " " + m.getVegetable().getBaseUnit().name(),
                    null,
                    m.getCreatedAt(),
                    "/staff/stock"));
        }

        List<SupplierPayment> recentSupplierPayments = supplierPayments
                .findAll(PageRequest.of(0, 3, Sort.by(Sort.Direction.DESC, "id"))).getContent();
        for (SupplierPayment sp : recentSupplierPayments) {
            items.add(new RecentActivityItem(
                    "SUPPLIER_PAYMENT",
                    "Paid " + sp.getSupplier().getName(),
                    sp.getPaymentMethod().name().replace('_', ' '),
                    scale(sp.getAmount()),
                    sp.getCreatedAt(),
                    "/staff/suppliers/" + sp.getSupplier().getId()));
        }

        items.sort(Comparator.comparing(RecentActivityItem::timestamp,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return items.size() > 8 ? items.subList(0, 8) : items;
    }

    private static int alertPriority(InventoryAlertItem item) {
        return switch (item.alertType()) {
            case "OUT_OF_STOCK" -> 0;
            case "CRITICAL_RISK" -> 1;
            case "HIGH_RISK" -> 2;
            default -> 3;
        };
    }

    private static BigDecimal scale(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }
}
