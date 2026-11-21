package com.tazatokri.inventory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.purchase.PurchaseItemRepository;
import com.tazatokri.sales.SaleItemRepository;

@Service
public class InventoryInsightsService {

    private static final BigDecimal THIRTY = new BigDecimal("30");
    private static final BigDecimal SEVEN = new BigDecimal("7");
    private static final BigDecimal TREND_THRESHOLD = new BigDecimal("0.15");
    private static final BigDecimal CRITICAL_DAYS = new BigDecimal("2.0");
    private static final BigDecimal HIGH_DAYS = new BigDecimal("5.0");

    private final VegetableRepository vegetables;
    private final StockMovementRepository movements;
    private final CustomerOrderRepository orders;
    private final SaleItemRepository saleItems;
    private final PurchaseItemRepository purchaseItems;
    private final Clock clock;

    public InventoryInsightsService(
            VegetableRepository vegetables,
            StockMovementRepository movements,
            CustomerOrderRepository orders,
            SaleItemRepository saleItems,
            PurchaseItemRepository purchaseItems,
            Clock clock) {
        this.vegetables = vegetables;
        this.movements = movements;
        this.orders = orders;
        this.saleItems = saleItems;
        this.purchaseItems = purchaseItems;
        this.clock = clock;
    }

    public record ProductDemandInsight(
            Long vegetableId,
            String name,
            String unit,
            BigDecimal currentStock,
            BigDecimal totalQtySold30d,
            BigDecimal totalQtySold7d,
            long orderCount30d,
            BigDecimal avgDailyDemand,
            BigDecimal avgDailyLast7d,
            BigDecimal avgDailyLast30d,
            SalesTrend salesTrend,
            BigDecimal daysRemaining,
            StockoutRisk stockoutRisk,
            BigDecimal forecastDemand,
            BigDecimal suggestedPurchaseQty,
            String recommendationReason,
            BigDecimal avgLandedCost,
            BigDecimal estimatedStockValue) {}

    public record InventoryInsightsDashboard(
            int planningHorizonDays,
            int totalActiveProducts,
            int activelySellingCount,
            int atRiskCount,
            int criticalRiskCount,
            int highRiskCount,
            int lowDemandCount,
            Map<String, BigDecimal> totalInventoryByUnit,
            BigDecimal estimatedInventoryValue,
            int valuedProductsCount,
            int uncostedProductsCount,
            List<ProductDemandInsight> bestSelling,
            List<ProductDemandInsight> slowMoving,
            List<ProductDemandInsight> increasingDemand,
            List<ProductDemandInsight> decreasingDemand,
            List<ProductDemandInsight> products) {}

    @Transactional(readOnly = true)
    public InventoryInsightsDashboard getDashboard(int planningHorizonDays) {
        validateHorizon(planningHorizonDays);

        List<Vegetable> activeVegs = vegetables.findByActiveTrueOrderByNameEnAsc();
        if (activeVegs.isEmpty()) {
            return new InventoryInsightsDashboard(
                    planningHorizonDays, 0, 0, 0, 0, 0, 0,
                    Map.of(), null, 0, 0,
                    List.of(), List.of(), List.of(), List.of(), List.of());
        }

        LocalDate today = LocalDate.now(clock);
        LocalDateTime to = today.plusDays(1).atStartOfDay();
        LocalDateTime from7d = today.minusDays(6).atStartOfDay();
        LocalDateTime from30d = today.minusDays(29).atStartOfDay();

        // Bulk queries (no N+1)
        Map<Long, BigDecimal> stockMap = new HashMap<>();
        for (StockMovementRepository.VegetableQty row : movements.stockOfActiveVegetables()) {
            stockMap.put(row.getVegetableId(), safeQty(row.getQty()));
        }

        Map<Long, DemandAgg> demand30d = aggregateDemand(from30d, to);
        Map<Long, DemandAgg> demand7d = aggregateDemand(from7d, to);

        List<Long> vegIds = activeVegs.stream().map(Vegetable::getId).toList();
        Map<Long, BigDecimal> costMap = new HashMap<>();
        for (PurchaseItemRepository.VegetableCostSummary cs : purchaseItems.summarizeForVegetables(vegIds)) {
            if (cs.getTotalQty() != null && cs.getTotalQty().signum() > 0 && cs.getTotalCost() != null) {
                costMap.put(cs.getVegetableId(),
                        cs.getTotalCost().divide(cs.getTotalQty(), 2, RoundingMode.HALF_UP));
            }
        }

        Map<String, BigDecimal> inventoryByUnit = new LinkedHashMap<>();
        BigDecimal totalValue = BigDecimal.ZERO;
        int valuedCount = 0;
        int uncostedCount = 0;
        int sellingCount = 0;
        int criticalCount = 0;
        int highCount = 0;
        int lowDemandCount = 0;

        List<ProductDemandInsight> insights = new ArrayList<>(activeVegs.size());
        for (Vegetable v : activeVegs) {
            BigDecimal currentStock = stockMap.getOrDefault(v.getId(), BigDecimal.ZERO).max(BigDecimal.ZERO)
                    .setScale(3, RoundingMode.HALF_UP);
            String unit = v.getBaseUnit() != null ? v.getBaseUnit().name() : "KG";
            inventoryByUnit.merge(unit, currentStock, BigDecimal::add);

            DemandAgg d30 = demand30d.getOrDefault(v.getId(), DemandAgg.ZERO);
            DemandAgg d7 = demand7d.getOrDefault(v.getId(), DemandAgg.ZERO);

            BigDecimal avgCost = costMap.get(v.getId());
            BigDecimal stockValue = null;
            if (avgCost != null) {
                stockValue = currentStock.multiply(avgCost).setScale(2, RoundingMode.HALF_UP);
                totalValue = totalValue.add(stockValue);
                valuedCount++;
            } else {
                uncostedCount++;
            }

            ProductDemandInsight insight = buildInsight(v, unit, currentStock, d30, d7, planningHorizonDays,
                    avgCost, stockValue);
            insights.add(insight);

            if (insight.totalQtySold30d().signum() > 0) {
                sellingCount++;
            }
            if (insight.stockoutRisk() == StockoutRisk.CRITICAL) {
                criticalCount++;
            } else if (insight.stockoutRisk() == StockoutRisk.HIGH) {
                highCount++;
            }
            if (insight.orderCount30d() < 2 || insight.totalQtySold30d().signum() == 0) {
                lowDemandCount++;
            }
        }

        List<ProductDemandInsight> bestSelling = insights.stream()
                .filter(i -> i.totalQtySold30d().signum() > 0)
                .sorted(Comparator.comparing(ProductDemandInsight::totalQtySold30d).reversed())
                .limit(5)
                .toList();

        List<ProductDemandInsight> slowMoving = insights.stream()
                .sorted(Comparator.comparing(ProductDemandInsight::totalQtySold30d)
                        .thenComparing(ProductDemandInsight::orderCount30d))
                .limit(5)
                .toList();

        List<ProductDemandInsight> increasing = insights.stream()
                .filter(i -> i.salesTrend() == SalesTrend.INCREASING)
                .sorted(Comparator.comparing(ProductDemandInsight::avgDailyLast7d).reversed())
                .limit(5)
                .toList();

        List<ProductDemandInsight> decreasing = insights.stream()
                .filter(i -> i.salesTrend() == SalesTrend.DECREASING)
                .sorted(Comparator.comparing(ProductDemandInsight::avgDailyLast30d).reversed())
                .limit(5)
                .toList();

        BigDecimal finalEstimatedValue = valuedCount > 0 ? totalValue.setScale(2, RoundingMode.HALF_UP) : null;

        return new InventoryInsightsDashboard(
                planningHorizonDays,
                activeVegs.size(),
                sellingCount,
                criticalCount + highCount,
                criticalCount,
                highCount,
                lowDemandCount,
                inventoryByUnit,
                finalEstimatedValue,
                valuedCount,
                uncostedCount,
                bestSelling,
                slowMoving,
                increasing,
                decreasing,
                insights);
    }

    @Transactional(readOnly = true)
    public ProductDemandInsight getProductInsight(Long vegetableId, int planningHorizonDays) {
        validateHorizon(planningHorizonDays);
        Vegetable v = vegetables.findWithDetailsById(vegetableId)
                .orElseThrow(() -> new ResourceNotFoundException("Vegetable not found: " + vegetableId));

        InventoryInsightsDashboard dash = getDashboard(planningHorizonDays);
        return dash.products().stream()
                .filter(p -> p.vegetableId().equals(v.getId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Vegetable is inactive: " + vegetableId));
    }

    private ProductDemandInsight buildInsight(
            Vegetable v,
            String unit,
            BigDecimal currentStock,
            DemandAgg d30,
            DemandAgg d7,
            int horizonDays,
            BigDecimal avgCost,
            BigDecimal stockValue) {

        BigDecimal qty30 = d30.qty().setScale(3, RoundingMode.HALF_UP);
        BigDecimal qty7 = d7.qty().setScale(3, RoundingMode.HALF_UP);
        long orderCount = d30.orderCount();

        BigDecimal avg30 = qty30.divide(THIRTY, 3, RoundingMode.HALF_UP);
        BigDecimal avg7 = qty7.divide(SEVEN, 3, RoundingMode.HALF_UP);
        BigDecimal avgDaily = avg30;

        boolean hasReliableHistory = orderCount >= 2 && avgDaily.signum() > 0;

        StockoutRisk risk;
        SalesTrend trend;
        BigDecimal daysRemaining = null;
        BigDecimal forecastDemand = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
        BigDecimal suggestedPurchase = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
        String reason;

        if (!hasReliableHistory) {
            risk = StockoutRisk.NO_DATA;
            trend = SalesTrend.NO_DATA;
            reason = orderCount == 0
                    ? "No sales in the last 30 days; insufficient data for forecasting."
                    : "Only 1 order in the last 30 days; insufficient history for reliable forecasting.";
        } else {
            daysRemaining = currentStock.signum() <= 0
                    ? BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP)
                    : currentStock.divide(avgDaily, 1, RoundingMode.HALF_UP);

            if (daysRemaining.compareTo(CRITICAL_DAYS) <= 0) {
                risk = StockoutRisk.CRITICAL;
            } else if (daysRemaining.compareTo(HIGH_DAYS) <= 0) {
                risk = StockoutRisk.HIGH;
            } else {
                risk = StockoutRisk.LOW;
            }

            BigDecimal ratio = avg7.subtract(avg30).divide(avg30, 4, RoundingMode.HALF_UP);
            if (ratio.compareTo(TREND_THRESHOLD) >= 0) {
                trend = SalesTrend.INCREASING;
            } else if (ratio.compareTo(TREND_THRESHOLD.negate()) <= 0) {
                trend = SalesTrend.DECREASING;
            } else {
                trend = SalesTrend.STABLE;
            }

            forecastDemand = avgDaily.multiply(BigDecimal.valueOf(horizonDays))
                    .setScale(3, RoundingMode.HALF_UP);
            suggestedPurchase = forecastDemand.subtract(currentStock).max(BigDecimal.ZERO)
                    .setScale(3, RoundingMode.HALF_UP);

            if (suggestedPurchase.signum() > 0) {
                reason = String.format(
                        "Est. %s days of stock left at %s %s/day. %d-day demand is %s %s; recommend buying %s %s.",
                        daysRemaining.toPlainString(),
                        avgDaily.stripTrailingZeros().toPlainString(), unit,
                        horizonDays,
                        forecastDemand.stripTrailingZeros().toPlainString(), unit,
                        suggestedPurchase.stripTrailingZeros().toPlainString(), unit);
            } else {
                reason = String.format(
                        "Sufficient stock (~%s days remaining) to cover %d-day demand of %s %s.",
                        daysRemaining.toPlainString(),
                        horizonDays,
                        forecastDemand.stripTrailingZeros().toPlainString(), unit);
            }
        }

        return new ProductDemandInsight(
                v.getId(),
                v.getNameEn(),
                unit,
                currentStock,
                qty30,
                qty7,
                orderCount,
                avgDaily,
                avg7,
                avg30,
                trend,
                daysRemaining,
                risk,
                forecastDemand,
                suggestedPurchase,
                reason,
                avgCost,
                stockValue);
    }

    private Map<Long, DemandAgg> aggregateDemand(LocalDateTime from, LocalDateTime to) {
        Map<Long, DemandAgg> map = new HashMap<>();
        for (CustomerOrderRepository.OrderItemDemand row : orders.summarizeValidOrderDemandBetween(from, to)) {
            map.merge(row.getVegetableId(),
                    new DemandAgg(safeQty(row.getQty()), row.getOrderCount() != null ? row.getOrderCount() : 0L),
                    DemandAgg::add);
        }
        for (SaleItemRepository.ShopSaleDemand row : saleItems.summarizeShopSalesBetween(from, to)) {
            map.merge(row.getVegetableId(),
                    new DemandAgg(safeQty(row.getQty()), row.getSaleCount() != null ? row.getSaleCount() : 0L),
                    DemandAgg::add);
        }
        return map;
    }

    private static void validateHorizon(int horizonDays) {
        if (horizonDays != 3 && horizonDays != 7 && horizonDays != 14) {
            throw new BadRequestException("Planning horizon must be 3, 7, or 14 days");
        }
    }

    private static BigDecimal safeQty(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private record DemandAgg(BigDecimal qty, long orderCount) {
        static final DemandAgg ZERO = new DemandAgg(BigDecimal.ZERO, 0L);

        DemandAgg add(DemandAgg other) {
            return new DemandAgg(this.qty.add(other.qty), this.orderCount + other.orderCount);
        }
    }
}
