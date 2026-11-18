package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;

import com.tazatokri.catalog.CatalogSeedService;
import com.tazatokri.catalog.Category;
import com.tazatokri.catalog.CategoryRepository;
import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.pricing.PriceSource;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.report.DailyReport;
import com.tazatokri.report.ReportService;
import com.tazatokri.sales.SaleItemRepository;
import com.tazatokri.sales.SaleRepository;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class TazatokriBackendApplicationTests {

    private static void setId(Object entity, Long id) {
        try {
            Field f = entity.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> T stub(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    @Test
    void catalogSeedSpecificationMatches36RequestedVegetablesWithNullImageUrlAndSampleNote() {
        List<CatalogSeedService.SeedVegetable> specs = CatalogSeedService.DEFAULT_VEGETABLES;
        assertEquals(36, specs.size(), "Default catalog must contain exactly 36 vegetables");

        long leafyCount = specs.stream().filter(v -> v.categoryName().equals("Leafy Greens")).count();
        long everydayCount = specs.stream().filter(v -> v.categoryName().equals("Everyday Vegetables")).count();
        long rootsCount = specs.stream().filter(v -> v.categoryName().equals("Roots & Tubers")).count();

        assertEquals(8, leafyCount);
        assertEquals(17, everydayCount);
        assertEquals(11, rootsCount);

        // Ensure Colocasia (Arbi) is not in the default seed specification
        assertFalse(specs.stream().anyMatch(v ->
                v.nameEn().toLowerCase().contains("colocasia") || v.nameEn().toLowerCase().contains("arbi")));

        // Verify Sweet Corn
        var sweetCorn = specs.stream()
                .filter(v -> v.nameEn().equals("Sweet Corn"))
                .findFirst()
                .orElseThrow();
        assertEquals("स्वीट कॉर्न", sweetCorn.nameMr());
        assertEquals("स्वीट कॉर्न", sweetCorn.nameHi());
        assertEquals("Roots & Tubers", sweetCorn.categoryName());
        assertEquals(UnitType.PIECE, sweetCorn.baseUnit());
        assertEquals(new BigDecimal("20.00"), sweetCorn.samplePrice());
        assertEquals(1, sweetCorn.units().size());
        assertEquals("1 piece", sweetCorn.units().get(0).label());
        assertEquals(new BigDecimal("1.000"), sweetCorn.units().get(0).quantityInBaseUnit());
        assertTrue(sweetCorn.units().get(0).defaultOption());

        // Verify corrected sample prices
        var byName = new LinkedHashMap<String, CatalogSeedService.SeedVegetable>();
        specs.forEach(v -> byName.put(v.nameEn(), v));

        assertEquals(new BigDecimal("35.00"), byName.get("Onion (Kanda)").samplePrice());
        assertEquals(new BigDecimal("50.00"), byName.get("Carrot (Gajar)").samplePrice());
        assertEquals(new BigDecimal("40.00"), byName.get("Sweet Potato (Ratale)").samplePrice());

        // Verify all 36 vegetables store null imageUrl (no Wikimedia URLs) and "Sample price - replace" note
        for (CatalogSeedService.SeedVegetable spec : specs) {
            assertNull(spec.imageUrl(), "Seeder must store null imageUrl for " + spec.nameEn());
            assertEquals("Sample price - replace", spec.priceNote());
        }
    }

    @Test
    void seedDefaultCatalogWritesNoPricesByDefaultAndRecordsManualSamplePricesWhenRequested() {
        AtomicLong catSeq = new AtomicLong(1);
        AtomicLong vegSeq = new AtomicLong(100);
        AtomicLong priceSeq = new AtomicLong(500);

        Map<Long, Category> categories = new LinkedHashMap<>();
        Map<Long, Vegetable> vegetables = new LinkedHashMap<>();
        Map<Long, List<VegetablePrice>> pricesByVeg = new LinkedHashMap<>();

        // Pre-populate 6 existing vegetables in the database with existing IDs, custom image, and manual price
        Category existingLeafy = new Category();
        setId(existingLeafy, catSeq.getAndIncrement());
        existingLeafy.setName("Leafy Greens");
        existingLeafy.setActive(true);
        categories.put(existingLeafy.getId(), existingLeafy);

        List<String> existingNames = List.of(
                "Fresh Coriander",
                "Spinach (Palak)",
                "Okra (Bhendi)",
                "Onion (Kanda)",
                "Potato (Batata)",
                "Tomato"
        );
        for (int i = 0; i < existingNames.size(); i++) {
            Vegetable v = new Vegetable();
            long id = i + 1L;
            setId(v, id);
            v.setNameEn(existingNames.get(i));
            v.setCategory(existingLeafy);
            v.setBaseUnit(i < 2 ? UnitType.BUNCH : UnitType.KG);
            v.setActive(true);
            v.setAvailable(true);
            if (existingNames.get(i).equals("Tomato")) {
                v.setImageUrl("/vegetables/owner-custom-tomato.jpg");
                VegetablePrice manualPrice = new VegetablePrice(
                        v, new BigDecimal("42.00"), PriceSource.MANUAL, "Owner manual price", 1L);
                setId(manualPrice, priceSeq.getAndIncrement());
                pricesByVeg.put(id, new ArrayList<>(List.of(manualPrice)));
            }
            vegetables.put(id, v);
        }

        CategoryRepository categoryRepo = stub(CategoryRepository.class, (proxy, method, args) -> {
            switch (method.getName()) {
                case "findByNameIgnoreCase": {
                    String name = (String) args[0];
                    return categories.values().stream()
                            .filter(c -> c.getName().equalsIgnoreCase(name))
                            .findFirst();
                }
                case "save": {
                    Category c = (Category) args[0];
                    if (c.getId() == null) {
                        setId(c, catSeq.getAndIncrement());
                    }
                    categories.put(c.getId(), c);
                    return c;
                }
                default:
                    throw new UnsupportedOperationException(method.getName());
            }
        });

        VegetableRepository vegetableRepo = stub(VegetableRepository.class, (proxy, method, args) -> {
            switch (method.getName()) {
                case "findByNameEnIgnoreCase": {
                    String name = (String) args[0];
                    return vegetables.values().stream()
                            .filter(v -> v.getNameEn().equalsIgnoreCase(name))
                            .findFirst();
                }
                case "save": {
                    Vegetable v = (Vegetable) args[0];
                    if (v.getId() == null) {
                        setId(v, vegSeq.getAndIncrement());
                    }
                    vegetables.put(v.getId(), v);
                    return v;
                }
                case "findByActiveTrueOrderByNameEnAsc":
                    return vegetables.values().stream().filter(Vegetable::isActive).toList();
                default:
                    throw new UnsupportedOperationException(method.getName());
            }
        });

        VegetablePriceRepository priceRepo = stub(VegetablePriceRepository.class, (proxy, method, args) -> {
            switch (method.getName()) {
                case "findFirstByVegetableIdOrderByIdDesc": {
                    Long vegId = (Long) args[0];
                    List<VegetablePrice> list = pricesByVeg.getOrDefault(vegId, List.of());
                    return list.isEmpty() ? Optional.empty() : Optional.of(list.get(list.size() - 1));
                }
                case "save": {
                    VegetablePrice p = (VegetablePrice) args[0];
                    if (p.getId() == null) {
                        setId(p, priceSeq.getAndIncrement());
                    }
                    pricesByVeg.computeIfAbsent(p.getVegetable().getId(), k -> new ArrayList<>()).add(p);
                    return p;
                }
                default:
                    throw new UnsupportedOperationException(method.getName());
            }
        });

        User owner = new User();
        setId(owner, 1L);
        UserRepository userRepo = stub(UserRepository.class, (proxy, method, args) -> {
            if ("findActiveByRole".equals(method.getName()) && args[0] == Role.OWNER) {
                return List.of(owner);
            }
            throw new UnsupportedOperationException(method.getName());
        });

        CatalogSeedService service = new CatalogSeedService(categoryRepo, vegetableRepo, priceRepo, userRepo);

        // 1. Default run (withSamplePrices = false): creates categories & vegetables ONLY, 0 prices
        CatalogSeedService.SeedSummary firstRun = service.seedDefaultCatalog();
        assertNotNull(firstRun);
        assertEquals(2, firstRun.categoriesCreated());
        assertEquals(1, firstRun.categoriesReused());
        assertEquals(30, firstRun.vegetablesAdded());
        assertEquals(6, firstRun.vegetablesReused());
        assertEquals(36, firstRun.totalVegetables());
        assertEquals(0, firstRun.pricesCreated(), "Default seed must NOT write any prices");
        assertEquals(1, pricesByVeg.size(), "Only the pre-existing Tomato price should exist");
        assertEquals("/vegetables/owner-custom-tomato.jpg", vegetables.get(6L).getImageUrl());

        // 2. Second run with sample prices enabled (withSamplePrices = true):
        //    Creates sample prices as PriceSource.MANUAL with note "Sample price - replace", preserving Tomato's price
        CatalogSeedService.SeedSummary withPricesRun = service.seedDefaultCatalog(true);
        assertEquals(0, withPricesRun.categoriesCreated());
        assertEquals(3, withPricesRun.categoriesReused());
        assertEquals(0, withPricesRun.vegetablesAdded());
        assertEquals(36, withPricesRun.vegetablesReused());
        assertEquals(0, withPricesRun.vegetablesUpdated());
        assertEquals(35, withPricesRun.pricesCreated(), "Tomato already had a manual price and must not be overwritten");

        List<VegetablePrice> tomatoPrices = pricesByVeg.get(6L);
        assertEquals(1, tomatoPrices.size());
        assertEquals(new BigDecimal("42.00"), tomatoPrices.get(0).getPricePerUnit());
        assertEquals("Owner manual price", tomatoPrices.get(0).getNote());

        VegetablePrice corianderPrice = pricesByVeg.get(1L).get(0);
        assertEquals(PriceSource.MANUAL, corianderPrice.getSource());
        assertEquals("Sample price - replace", corianderPrice.getNote());

        // 3. Third run with sample prices enabled: 100% idempotent (0 prices created)
        CatalogSeedService.SeedSummary thirdRun = service.seedDefaultCatalog(true);
        assertEquals(0, thirdRun.pricesCreated());
        assertEquals(0, thirdRun.vegetablesAdded());
        assertEquals(0, thirdRun.vegetablesUpdated());

        // Verify ReportService includes all 36 active vegetables (with 0 stock for newly seeded items)
        SaleRepository saleRepo = stub(SaleRepository.class, (p, m, a) -> List.of());
        SaleItemRepository saleItemRepo = stub(SaleItemRepository.class, (p, m, a) -> List.of());
        PurchaseRepository purchaseRepo = stub(PurchaseRepository.class, (p, m, a) -> BigDecimal.ZERO);
        StockMovementRepository movementRepo = stub(StockMovementRepository.class, (p, m, a) -> {
            if ("wastageBetween".equals(m.getName())) {
                return List.of();
            }
            if ("stockForVegetables".equals(m.getName())) {
                StockMovementRepository.VegetableQty row = new StockMovementRepository.VegetableQty() {
                    @Override
                    public Long getVegetableId() {
                        return 1L;
                    }

                    @Override
                    public String getName() {
                        return "Fresh Coriander";
                    }

                    @Override
                    public BigDecimal getQty() {
                        return new BigDecimal("50.000");
                    }
                };
                return List.of(row);
            }
            throw new UnsupportedOperationException(m.getName());
        });

        ReportService reportService = new ReportService(saleRepo, saleItemRepo, purchaseRepo, movementRepo, vegetableRepo);
        DailyReport report = reportService.daily(LocalDate.now());
        assertEquals(36, report.stock().size(), "Daily report must include all 36 active vegetables");
        assertEquals(new BigDecimal("50.000"),
                report.stock().stream().filter(s -> s.vegetableId().equals(1L)).findFirst().orElseThrow().quantity());
        assertEquals(BigDecimal.ZERO,
                report.stock().stream().filter(s -> !s.vegetableId().equals(1L)).findFirst().orElseThrow().quantity());
    }
}
