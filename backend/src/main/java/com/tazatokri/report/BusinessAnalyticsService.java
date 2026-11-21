package com.tazatokri.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.loyalty.LoyaltyService;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.sales.SaleItemRepository;
import com.tazatokri.sales.SalePaymentMethod;
import com.tazatokri.sales.SaleRepository;

@Service
public class BusinessAnalyticsService {

    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal LOW_STOCK_THRESHOLD = new BigDecimal("5");

    public record DailyTrendPoint(
            LocalDate date,
            BigDecimal totalSales,
            BigDecimal posSales,
            BigDecimal onlineSales,
            long orderCount) {}

    public record ProductSaleLine(
            Long vegetableId,
            String name,
            BigDecimal quantity,
            BigDecimal revenue) {}

    public record ZeroSaleProduct(
            Long vegetableId,
            String name,
            BigDecimal currentStock) {}

    public record PaymentMethodBreakdown(
            String channel,
            String label,
            long count,
            BigDecimal amount) {}

    public record BusinessAnalyticsReport(
            LocalDate from,
            LocalDate to,
            BigDecimal totalSales,
            long totalOrders,
            long posBills,
            long onlineValidOrders,
            BigDecimal averageOrderValue,
            BigDecimal totalItemsSold,
            BigDecimal cashCollections,
            BigDecimal upiDigitalCollections,
            BigDecimal codCollected,
            BigDecimal codSettledToShop,
            BigDecimal codPendingSettlement,
            BigDecimal totalRefunds,
            BigDecimal cashRefunds,
            BigDecimal digitalRefunds,
            long cancelledOrders,
            long deliveredOrders,
            long pendingOrders,
            long completedOrders,
            BigDecimal averageDailySales,
            DailyTrendPoint highestSalesDay,
            List<DailyTrendPoint> dailyTrend,
            List<PaymentMethodBreakdown> paymentBreakdown,
            List<ProductSaleLine> topProducts,
            ProductSaleLine bestSellingProduct,
            List<ZeroSaleProduct> zeroSaleProducts,
            long lowStockCount,
            long outOfStockCount,
            long totalActiveProducts,
            BigDecimal purchaseSpend,
            long loyaltyPointsIssued,
            long loyaltyPointsRedeemed,
            long loyaltyOutstandingLiability,
            long loyaltyRedemptionOrders) {}

    private final SaleRepository sales;
    private final SaleItemRepository saleItems;
    private final CustomerOrderRepository orders;
    private final PaymentRepository payments;
    private final PurchaseRepository purchases;
    private final VegetableRepository vegetables;
    private final StockMovementRepository movements;
    private final Clock clock;

    @Autowired(required = false)
    private LoyaltyService loyaltyService;

    public BusinessAnalyticsService(
            SaleRepository sales,
            SaleItemRepository saleItems,
            CustomerOrderRepository orders,
            PaymentRepository payments,
            PurchaseRepository purchases,
            VegetableRepository vegetables,
            StockMovementRepository movements) {
        this(sales, saleItems, orders, payments, purchases, vegetables, movements, Clock.system(IST));
    }

    @Autowired
    public BusinessAnalyticsService(
            SaleRepository sales,
            SaleItemRepository saleItems,
            CustomerOrderRepository orders,
            PaymentRepository payments,
            PurchaseRepository purchases,
            VegetableRepository vegetables,
            StockMovementRepository movements,
            Clock clock) {
        this.sales = sales;
        this.saleItems = saleItems;
        this.orders = orders;
        this.payments = payments;
        this.purchases = purchases;
        this.vegetables = vegetables;
        this.movements = movements;
        this.clock = clock != null ? clock : Clock.system(IST);
    }

    @Transactional(readOnly = true)
    public BusinessAnalyticsReport analytics(LocalDate from, LocalDate to) {
        LocalDate todayIst = LocalDate.now(clock.withZone(IST));
        LocalDate resolvedTo = to != null ? to : todayIst;
        LocalDate resolvedFrom = from != null ? from : resolvedTo.minusDays(6);

        if (resolvedFrom.isAfter(resolvedTo)) {
            throw new BadRequestException("Start date cannot be after end date");
        }
        long days = ChronoUnit.DAYS.between(resolvedFrom, resolvedTo) + 1;
        if (days > 366) {
            throw new BadRequestException("Date range cannot exceed 366 days");
        }

        LocalDateTime periodStart = resolvedFrom.atStartOfDay();
        LocalDateTime periodEnd = resolvedTo.plusDays(1).atStartOfDay();

        // 1. POS Sales summary (Cash + UPI)
        BigDecimal posCash = zero();
        long posCashBills = 0;
        BigDecimal posUpi = zero();
        long posUpiBills = 0;
        for (SaleRepository.PaymentSummary row : sales.summarizeByPayment(periodStart, periodEnd)) {
            if (row.getMethod() == SalePaymentMethod.CASH) {
                posCash = scale(row.getTotal());
                posCashBills = row.getBills() != null ? row.getBills() : 0L;
            } else if (row.getMethod() == SalePaymentMethod.UPI) {
                posUpi = scale(row.getTotal());
                posUpiBills = row.getBills() != null ? row.getBills() : 0L;
            }
        }
        BigDecimal posTotal = posCash.add(posUpi);
        long posBills = posCashBills + posUpiBills;

        // 2. Online Orders summary by status (excludes CANCELLED & PENDING_PAYMENT from sales)
        long deliveredOrders = 0;
        long pendingOrders = 0;
        long cancelledOrders = 0;
        long onlineValidOrders = 0;
        BigDecimal onlineValidTotal = zero();

        for (CustomerOrderRepository.StatusSummary s : orders.summarizeByStatusBetween(periodStart, periodEnd)) {
            long cnt = s.getCnt() != null ? s.getCnt() : 0L;
            BigDecimal amt = scale(s.getTotal());
            if (s.getStatus() == OrderStatus.CANCELLED) {
                cancelledOrders += cnt;
            } else if (s.getStatus() == OrderStatus.PENDING_PAYMENT) {
                pendingOrders += cnt;
            } else {
                onlineValidOrders += cnt;
                onlineValidTotal = onlineValidTotal.add(amt);
                if (s.getStatus() == OrderStatus.DELIVERED) {
                    deliveredOrders += cnt;
                } else {
                    pendingOrders += cnt;
                }
            }
        }

        BigDecimal totalSales = posTotal.add(onlineValidTotal).setScale(2, RoundingMode.HALF_UP);
        long totalOrders = posBills + onlineValidOrders;
        BigDecimal averageOrderValue = totalOrders == 0
                ? zero()
                : totalSales.divide(BigDecimal.valueOf(totalOrders), 2, RoundingMode.HALF_UP);

        // 3. Actual Payment Collections & Refunds (never double-counted)
        BigDecimal codCollected = zero();
        long codBills = 0;
        BigDecimal deliveryUpi = zero();
        long deliveryUpiBills = 0;
        BigDecimal razorpay = zero();
        long razorpayBills = 0;

        for (PaymentRepository.MethodTotal row : payments.sumSuccessfulCollectionsByMethodBetween(periodStart, periodEnd)) {
            long cnt = row.getBills() != null ? row.getBills() : 0L;
            BigDecimal amt = scale(row.getTotal());
            if (row.getMethod() == PaymentMethod.CASH) {
                codCollected = amt;
                codBills = cnt;
            } else if (row.getMethod() == PaymentMethod.UPI_QR) {
                deliveryUpi = amt;
                deliveryUpiBills = cnt;
            } else if (row.getMethod() == PaymentMethod.RAZORPAY) {
                razorpay = amt;
                razorpayBills = cnt;
            }
        }

        BigDecimal codSettledToShop = scale(payments.sumCashSettledBetween(periodStart, periodEnd));
        BigDecimal codPendingSettlement = scale(payments.sumPendingCashTotal());
        BigDecimal cashRefunds = scale(payments.sumSuccessfulRefundsByMethodBetween(PaymentMethod.CASH, periodStart, periodEnd));
        BigDecimal digitalRefunds = scale(payments.sumSuccessfulRefundsByMethodBetween(PaymentMethod.RAZORPAY, periodStart, periodEnd));
        BigDecimal totalRefunds = cashRefunds.add(digitalRefunds).setScale(2, RoundingMode.HALF_UP);

        BigDecimal cashCollections = posCash.add(codSettledToShop).setScale(2, RoundingMode.HALF_UP);
        BigDecimal upiDigitalCollections = posUpi.add(deliveryUpi).add(razorpay).setScale(2, RoundingMode.HALF_UP);

        List<PaymentMethodBreakdown> paymentBreakdown = List.of(
                new PaymentMethodBreakdown("POS_CASH", "Shop Cash (POS)", posCashBills, posCash),
                new PaymentMethodBreakdown("POS_UPI", "Shop UPI (POS)", posUpiBills, posUpi),
                new PaymentMethodBreakdown("COD_CASH", "COD Cash Collected", codBills, codCollected),
                new PaymentMethodBreakdown("DELIVERY_UPI", "Delivery UPI QR", deliveryUpiBills, deliveryUpi),
                new PaymentMethodBreakdown("RAZORPAY", "Online (Razorpay)", razorpayBills, razorpay));

        // 4. Daily Sales & Order Trend
        Map<LocalDate, BigDecimal> posByDay = new HashMap<>();
        Map<LocalDate, Long> posCountByDay = new HashMap<>();
        for (SaleRepository.DailySaleSummary ds : sales.summarizeDailySalesBetween(periodStart, periodEnd)) {
            LocalDate d = toLocalDate(ds.getDay());
            if (d != null) {
                posByDay.merge(d, scale(ds.getTotal()), BigDecimal::add);
                posCountByDay.merge(d, ds.getBills() != null ? ds.getBills() : 0L, Long::sum);
            }
        }

        Map<LocalDate, BigDecimal> onlineByDay = new HashMap<>();
        Map<LocalDate, Long> onlineCountByDay = new HashMap<>();
        for (CustomerOrderRepository.DailyOrderSummary dord : orders.summarizeDailyValidOrdersBetween(periodStart, periodEnd)) {
            LocalDate d = toLocalDate(dord.getDay());
            if (d != null) {
                onlineByDay.merge(d, scale(dord.getTotal()), BigDecimal::add);
                onlineCountByDay.merge(d, dord.getCnt() != null ? dord.getCnt() : 0L, Long::sum);
            }
        }

        List<DailyTrendPoint> dailyTrend = new ArrayList<>();
        DailyTrendPoint highestDay = null;
        for (LocalDate d = resolvedFrom; !d.isAfter(resolvedTo); d = d.plusDays(1)) {
            BigDecimal posDay = posByDay.getOrDefault(d, zero());
            BigDecimal onlineDay = onlineByDay.getOrDefault(d, zero());
            BigDecimal dayTotal = posDay.add(onlineDay).setScale(2, RoundingMode.HALF_UP);
            long dayOrders = posCountByDay.getOrDefault(d, 0L) + onlineCountByDay.getOrDefault(d, 0L);
            DailyTrendPoint pt = new DailyTrendPoint(d, dayTotal, posDay, onlineDay, dayOrders);
            dailyTrend.add(pt);
            if (dayTotal.signum() > 0 && (highestDay == null || dayTotal.compareTo(highestDay.totalSales()) > 0)) {
                highestDay = pt;
            }
        }

        BigDecimal averageDailySales = totalSales.divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP);

        // 5. Product Analytics (merged POS SaleItems + Valid OrderItems)
        Map<Long, ProductAgg> productAgg = new LinkedHashMap<>();
        for (SaleItemRepository.TopItem item : saleItems.topItems(periodStart, periodEnd)) {
            productAgg.computeIfAbsent(item.getVegetableId(), id -> new ProductAgg(id, item.getName()))
                    .add(item.getQty(), item.getRevenue());
        }
        for (CustomerOrderRepository.OrderItemSummary item : orders.summarizeValidOrderItemsBetween(periodStart, periodEnd)) {
            productAgg.computeIfAbsent(item.getVegetableId(), id -> new ProductAgg(id, item.getName()))
                    .add(item.getQty(), item.getRevenue());
        }

        List<ProductSaleLine> topProducts = productAgg.values().stream()
                .map(a -> new ProductSaleLine(
                        a.id,
                        a.name,
                        a.qty.setScale(3, RoundingMode.HALF_UP),
                        a.revenue.setScale(2, RoundingMode.HALF_UP)))
                .sorted(Comparator.comparing(ProductSaleLine::revenue).reversed())
                .toList();

        BigDecimal totalItemsSold = topProducts.stream()
                .map(ProductSaleLine::quantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(3, RoundingMode.HALF_UP);

        ProductSaleLine bestSellingProduct = topProducts.isEmpty() ? null : topProducts.get(0);

        // 6. Inventory & Purchase Insights + Zero-Sale Products
        List<Vegetable> activeVegetables = vegetables.findByActiveTrueOrderByNameEnAsc();
        List<Long> vegIds = activeVegetables.stream().map(Vegetable::getId).toList();
        Map<Long, BigDecimal> stockById = new HashMap<>();
        if (!vegIds.isEmpty()) {
            movements.stockForVegetables(vegIds)
                    .forEach(s -> stockById.put(s.getVegetableId(), s.getQty()));
        }

        long lowStockCount = 0;
        long outOfStockCount = 0;
        List<ZeroSaleProduct> zeroSaleProducts = new ArrayList<>();
        for (Vegetable v : activeVegetables) {
            BigDecimal st = stockById.getOrDefault(v.getId(), BigDecimal.ZERO);
            if (st.signum() <= 0) {
                outOfStockCount++;
            } else if (st.compareTo(LOW_STOCK_THRESHOLD) <= 0) {
                lowStockCount++;
            }
            if (!productAgg.containsKey(v.getId())) {
                zeroSaleProducts.add(new ZeroSaleProduct(v.getId(), v.getNameEn(), st));
            }
        }

        BigDecimal purchaseSpend = scale(purchases.totalSpendBetween(resolvedFrom, resolvedTo));

        LoyaltyService.LoyaltyAnalyticsSummary loyalty = loyaltyService != null
                ? loyaltyService.analyticsSummary(periodStart, periodEnd)
                : new LoyaltyService.LoyaltyAnalyticsSummary(0L, 0L, 0L, 0L);

        return new BusinessAnalyticsReport(
                resolvedFrom,
                resolvedTo,
                totalSales,
                totalOrders,
                posBills,
                onlineValidOrders,
                averageOrderValue,
                totalItemsSold,
                cashCollections,
                upiDigitalCollections,
                codCollected,
                codSettledToShop,
                codPendingSettlement,
                totalRefunds,
                cashRefunds,
                digitalRefunds,
                cancelledOrders,
                deliveredOrders,
                pendingOrders,
                deliveredOrders,
                averageDailySales,
                highestDay,
                dailyTrend,
                paymentBreakdown,
                topProducts,
                bestSellingProduct,
                zeroSaleProducts,
                lowStockCount,
                outOfStockCount,
                activeVegetables.size(),
                purchaseSpend,
                loyalty.pointsIssued(),
                loyalty.pointsRedeemed(),
                loyalty.outstandingPointsLiability(),
                loyalty.loyaltyRedemptionOrders());
    }

    private static final class ProductAgg {
        final Long id;
        final String name;
        BigDecimal qty = BigDecimal.ZERO;
        BigDecimal revenue = BigDecimal.ZERO;

        ProductAgg(Long id, String name) {
            this.id = id;
            this.name = name;
        }

        void add(BigDecimal q, BigDecimal r) {
            if (q != null) qty = qty.add(q);
            if (r != null) revenue = revenue.add(r);
        }
    }

    private static LocalDate toLocalDate(Object raw) {
        if (raw == null) return null;
        if (raw instanceof LocalDate ld) return ld;
        if (raw instanceof java.sql.Date sd) return sd.toLocalDate();
        return LocalDate.parse(raw.toString());
    }

    private static BigDecimal zero() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale(BigDecimal v) {
        return v == null ? zero() : v.setScale(2, RoundingMode.HALF_UP);
    }
}
