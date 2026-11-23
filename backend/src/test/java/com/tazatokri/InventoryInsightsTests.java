package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.inventory.InventoryInsightsController;
import com.tazatokri.inventory.InventoryInsightsService;
import com.tazatokri.inventory.SalesTrend;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.inventory.StockoutRisk;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.purchase.PurchaseItemRepository;
import com.tazatokri.sales.SaleItemRepository;

class InventoryInsightsTests {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-11-21T10:00:00Z"), IST);

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    private static Vegetable veg(long id, String name, UnitType unit) {
        Vegetable v = new Vegetable();
        v.setId(id);
        v.setNameEn(name);
        v.setBaseUnit(unit);
        v.setActive(true);
        return v;
    }

    private static StockMovementRepository.VegetableQty stockRow(long id, String name, String qty) {
        return new StockMovementRepository.VegetableQty() {
            @Override public Long getVegetableId() { return id; }
            @Override public String getName() { return name; }
            @Override public BigDecimal getQty() { return new BigDecimal(qty); }
        };
    }

    private static CustomerOrderRepository.OrderItemDemand orderDemand(long id, long count, String qty) {
        return new CustomerOrderRepository.OrderItemDemand() {
            @Override public Long getVegetableId() { return id; }
            @Override public Long getOrderCount() { return count; }
            @Override public BigDecimal getQty() { return new BigDecimal(qty); }
        };
    }

    private static SaleItemRepository.ShopSaleDemand shopDemand(long id, long count, String qty) {
        return new SaleItemRepository.ShopSaleDemand() {
            @Override public Long getVegetableId() { return id; }
            @Override public Long getSaleCount() { return count; }
            @Override public BigDecimal getQty() { return new BigDecimal(qty); }
        };
    }

    private static PurchaseItemRepository.VegetableCostSummary costRow(long id, String totalCost, String totalQty) {
        return new PurchaseItemRepository.VegetableCostSummary() {
            @Override public Long getVegetableId() { return id; }
            @Override public BigDecimal getTotalCost() { return new BigDecimal(totalCost); }
            @Override public BigDecimal getTotalQty() { return new BigDecimal(totalQty); }
        };
    }

    @Test
    void calculatesDemandRiskTrendsPurchaseRecommendationsAndUnits() {
        List<Vegetable> vegs = List.of(
                veg(1L, "Tomato", UnitType.KG),       // CRITICAL + INCREASING (0 stock, 60kg/30d=2/d, 28kg/7d=4/d)
                veg(2L, "Onion", UnitType.KG),        // HIGH + STABLE (12kg stock, 90kg/30d=3/d -> 4.0d, 21kg/7d=3/d)
                veg(3L, "Potato", UnitType.KG),       // LOW + DECREASING (50kg stock, 60kg/30d=2/d -> 25d, 3.5kg/7d=0.5/d)
                veg(4L, "Coriander", UnitType.BUNCH), // NO_DATA (1 order only)
                veg(5L, "Coconut", UnitType.PIECE)    // NO_DATA (0 sales, 0 stock)
        );

        VegetableRepository vegRepo = proxy(VegetableRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByActiveTrueOrderByNameEnAsc" -> vegs;
            default -> throw new UnsupportedOperationException(m.getName());
        });

        StockMovementRepository movRepo = proxy(StockMovementRepository.class, (p, m, a) -> switch (m.getName()) {
            case "stockOfActiveVegetables" -> List.of(
                    stockRow(1L, "Tomato", "0.000"),
                    stockRow(2L, "Onion", "12.000"),
                    stockRow(3L, "Potato", "50.000"),
                    stockRow(4L, "Coriander", "10.000")
            );
            default -> throw new UnsupportedOperationException(m.getName());
        });

        // 7d window starts at 2026-11-15T00:00, 30d window starts at 2026-10-23T00:00
        LocalDateTime expectedFrom7d = LocalDateTime.of(2026, 11, 15, 0, 0);

        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> {
            if ("summarizeValidOrderDemandBetween".equals(m.getName())) {
                LocalDateTime from = (LocalDateTime) a[0];
                if (from.equals(expectedFrom7d)) {
                    return List.of(
                            orderDemand(1L, 5, "20.000"),
                            orderDemand(2L, 4, "15.000"),
                            orderDemand(3L, 1, "3.500")
                    );
                }
                return List.of(
                        orderDemand(1L, 12, "40.000"),
                        orderDemand(2L, 10, "60.000"),
                        orderDemand(3L, 8, "60.000"),
                        orderDemand(4L, 1, "2.000")
                );
            }
            throw new UnsupportedOperationException(m.getName());
        });

        SaleItemRepository saleRepo = proxy(SaleItemRepository.class, (p, m, a) -> {
            if ("summarizeShopSalesBetween".equals(m.getName())) {
                LocalDateTime from = (LocalDateTime) a[0];
                if (from.equals(expectedFrom7d)) {
                    return List.of(
                            shopDemand(1L, 3, "8.000"),
                            shopDemand(2L, 2, "6.000")
                    );
                }
                return List.of(
                        shopDemand(1L, 6, "20.000"),
                        shopDemand(2L, 5, "30.000")
                );
            }
            throw new UnsupportedOperationException(m.getName());
        });

        PurchaseItemRepository purRepo = proxy(PurchaseItemRepository.class, (p, m, a) -> switch (m.getName()) {
            case "summarizeForVegetables" -> List.of(
                    costRow(2L, "360.00", "12.000"), // 30.00/kg * 12 = 360.00
                    costRow(3L, "1000.00", "50.000") // 20.00/kg * 50 = 1000.00
            );
            default -> throw new UnsupportedOperationException(m.getName());
        });

        InventoryInsightsService service = new InventoryInsightsService(
                vegRepo, movRepo, orderRepo, saleRepo, purRepo, FIXED_CLOCK);

        InventoryInsightsService.InventoryInsightsDashboard dash = service.getDashboard(7);
        assertEquals(7, dash.planningHorizonDays());
        assertEquals(5, dash.totalActiveProducts());
        assertEquals(4, dash.activelySellingCount());
        assertEquals(2, dash.atRiskCount());
        assertEquals(1, dash.criticalRiskCount());
        assertEquals(1, dash.highRiskCount());
        assertEquals(1, dash.lowDemandCount());
        assertEquals(2, dash.noSalesHistoryCount());
        assertEquals(new BigDecimal("1360.00"), dash.estimatedInventoryValue());

        // Unit consistency: KG, BUNCH, PIECE kept separate
        Map<String, BigDecimal> byUnit = dash.totalInventoryByUnit();
        assertEquals(new BigDecimal("62.000"), byUnit.get("KG"));
        assertEquals(new BigDecimal("10.000"), byUnit.get("BUNCH"));
        assertEquals(new BigDecimal("0.000"), byUnit.get("PIECE"));

        var tomato = dash.products().stream().filter(p -> p.vegetableId() == 1L).findFirst().orElseThrow();
        assertEquals(new BigDecimal("60.000"), tomato.totalQtySold30d());
        assertEquals(new BigDecimal("28.000"), tomato.totalQtySold7d());
        assertEquals(18L, tomato.orderCount30d());
        assertEquals(new BigDecimal("2.000"), tomato.avgDailyDemand());
        assertEquals(new BigDecimal("4.000"), tomato.avgDailyLast7d());
        assertEquals(StockoutRisk.CRITICAL, tomato.stockoutRisk());
        assertEquals(SalesTrend.INCREASING, tomato.salesTrend());
        assertEquals(InventoryInsightsService.DemandCategory.INCREASING_DEMAND, tomato.demandCategory());
        assertEquals(InventoryInsightsService.PurchaseAction.BUY_TODAY, tomato.purchaseAction());
        assertTrue(tomato.lowStock());
        assertEquals(new BigDecimal("0.0"), tomato.daysRemaining());
        assertEquals(new BigDecimal("14.000"), tomato.forecastDemand());
        assertEquals(new BigDecimal("14.000"), tomato.suggestedPurchaseQty());

        var onion = dash.products().stream().filter(p -> p.vegetableId() == 2L).findFirst().orElseThrow();
        assertEquals(StockoutRisk.HIGH, onion.stockoutRisk());
        assertEquals(SalesTrend.STABLE, onion.salesTrend());
        assertEquals(InventoryInsightsService.DemandCategory.SELLING_WELL, onion.demandCategory());
        assertEquals(InventoryInsightsService.PurchaseAction.PURCHASE_SOON, onion.purchaseAction());
        assertTrue(onion.lowStock());
        assertEquals(new BigDecimal("4.0"), onion.daysRemaining());
        // 7d demand = 21.000, stock = 12.000 -> suggested = 9.000
        assertEquals(new BigDecimal("9.000"), onion.suggestedPurchaseQty());

        var potato = dash.products().stream().filter(p -> p.vegetableId() == 3L).findFirst().orElseThrow();
        assertEquals(StockoutRisk.LOW, potato.stockoutRisk());
        assertEquals(SalesTrend.DECREASING, potato.salesTrend());
        assertEquals(InventoryInsightsService.DemandCategory.DECREASING_DEMAND, potato.demandCategory());
        assertEquals(InventoryInsightsService.PurchaseAction.REDUCE_PURCHASE, potato.purchaseAction());
        assertTrue(potato.wastageRisk());
        assertEquals(new BigDecimal("0.000"), potato.suggestedPurchaseQty());

        var coriander = dash.products().stream().filter(p -> p.vegetableId() == 4L).findFirst().orElseThrow();
        assertEquals(StockoutRisk.NO_DATA, coriander.stockoutRisk());
        assertEquals(SalesTrend.NO_DATA, coriander.salesTrend());
        assertEquals(InventoryInsightsService.DemandCategory.INSUFFICIENT_DATA, coriander.demandCategory());
        assertEquals(InventoryInsightsService.PurchaseAction.NO_DATA, coriander.purchaseAction());
        assertNull(coriander.daysRemaining());
        assertEquals(BigDecimal.ZERO.setScale(3), coriander.suggestedPurchaseQty());

        var coconut = dash.products().stream().filter(p -> p.vegetableId() == 5L).findFirst().orElseThrow();
        assertEquals(StockoutRisk.NO_DATA, coconut.stockoutRisk());
        assertEquals(InventoryInsightsService.DemandCategory.NO_SALES_HISTORY, coconut.demandCategory());
        assertEquals(InventoryInsightsService.PurchaseAction.NO_DATA, coconut.purchaseAction());
        assertEquals(BigDecimal.ZERO.setScale(3), coconut.suggestedPurchaseQty());
        assertTrue(dash.slowMoving().isEmpty());

        // Planning horizon 14 days
        InventoryInsightsService.InventoryInsightsDashboard dash14 = service.getDashboard(14);
        var onion14 = dash14.products().stream().filter(p -> p.vegetableId() == 2L).findFirst().orElseThrow();
        // 14d * 3/d = 42 - 12 = 30.000
        assertEquals(new BigDecimal("30.000"), onion14.suggestedPurchaseQty());
    }

    @Test
    void validatesPlanningHorizonAndOwnerAuthorization() {
        InventoryInsightsService service = new InventoryInsightsService(
                proxy(VegetableRepository.class, (p, m, a) -> List.of()),
                proxy(StockMovementRepository.class, (p, m, a) -> List.of()),
                proxy(CustomerOrderRepository.class, (p, m, a) -> List.of()),
                proxy(SaleItemRepository.class, (p, m, a) -> List.of()),
                proxy(PurchaseItemRepository.class, (p, m, a) -> List.of()),
                FIXED_CLOCK);

        assertThrows(BadRequestException.class, () -> service.getDashboard(5));
        assertThrows(BadRequestException.class, () -> service.getDashboard(0));

        PreAuthorize auth = InventoryInsightsController.class.getAnnotation(PreAuthorize.class);
        assertTrue(auth != null && "hasRole('OWNER')".equals(auth.value()));
    }

    @Test
    void separatesNewAndZeroSalesProductsFromGenuineSlowMovingAndWastageRisk() {
        Vegetable newItem = veg(10L, "Broccoli", UnitType.PIECE);
        newItem.setCreatedAt(LocalDateTime.of(2026, 11, 19, 9, 0));

        Vegetable slowItem = veg(11L, "Ginger", UnitType.BUNCH);
        slowItem.setCreatedAt(LocalDateTime.of(2026, 9, 1, 9, 0));

        VegetableRepository vegRepo = proxy(VegetableRepository.class, (p, m, a) -> List.of(newItem, slowItem));
        StockMovementRepository movRepo = proxy(StockMovementRepository.class, (p, m, a) -> List.of(
                stockRow(10L, "Broccoli", "15.000"),
                stockRow(11L, "Ginger", "200.000")
        ));

        LocalDateTime expectedFrom7d = LocalDateTime.of(2026, 11, 15, 0, 0);
        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> {
            LocalDateTime from = (LocalDateTime) a[0];
            if (from.equals(expectedFrom7d)) {
                return List.of(orderDemand(11L, 1, "70.000"));
            }
            return List.of(orderDemand(11L, 3, "300.000"));
        });
        SaleItemRepository saleRepo = proxy(SaleItemRepository.class, (p, m, a) -> List.of());
        PurchaseItemRepository purRepo = proxy(PurchaseItemRepository.class, (p, m, a) -> List.of());

        InventoryInsightsService service = new InventoryInsightsService(
                vegRepo, movRepo, orderRepo, saleRepo, purRepo, FIXED_CLOCK);

        InventoryInsightsService.InventoryInsightsDashboard dash = service.getDashboard(7);
        assertEquals(1, dash.noSalesHistoryCount());
        assertEquals(1, dash.lowDemandCount());
        assertEquals(1, dash.slowMoving().size());
        assertEquals("Ginger", dash.slowMoving().get(0).name());
        assertEquals(1, dash.wastageRiskProducts().size());
        assertEquals("Ginger", dash.wastageRiskProducts().get(0).name());

        var broccoli = dash.products().stream().filter(p -> p.vegetableId() == 10L).findFirst().orElseThrow();
        assertEquals(InventoryInsightsService.DemandCategory.NO_SALES_HISTORY, broccoli.demandCategory());
        assertEquals(InventoryInsightsService.PurchaseAction.NO_DATA, broccoli.purchaseAction());
        assertTrue(broccoli.recommendationReason().toLowerCase().contains("newly added"));

        var ginger = dash.products().stream().filter(p -> p.vegetableId() == 11L).findFirst().orElseThrow();
        assertEquals(InventoryInsightsService.DemandCategory.SLOW_MOVING, ginger.demandCategory());
        assertEquals(InventoryInsightsService.PurchaseAction.REDUCE_PURCHASE, ginger.purchaseAction());
        assertTrue(ginger.wastageRisk());
    }
}
