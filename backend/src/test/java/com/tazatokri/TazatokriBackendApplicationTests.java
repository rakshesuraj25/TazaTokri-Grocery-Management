package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.tazatokri.ai.AiAssistantService;
import com.tazatokri.ai.AiDtos.PurchaseInvoiceDraftDto;
import com.tazatokri.ai.AiDtos.QuickSaleDraftDto;
import com.tazatokri.ai.AiExtractionLog;
import com.tazatokri.ai.AiExtractionLogRepository;
import com.tazatokri.ai.GeminiProvider;
import com.tazatokri.basket.BasketService;
import com.tazatokri.basket.RecurringBasketSchedule;
import com.tazatokri.basket.RecurringBasketScheduleRepository;
import com.tazatokri.basket.SavedBasket;
import com.tazatokri.basket.SavedBasketRepository;
import com.tazatokri.basket.ScheduleFrequency;
import com.tazatokri.basket.ScheduleStatus;
import com.tazatokri.catalog.CatalogSeedService;
import com.tazatokri.catalog.Category;
import com.tazatokri.catalog.CategoryRepository;
import com.tazatokri.catalog.PublicCatalogService;
import com.tazatokri.catalog.PublicVegetableResponse;
import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.catalog.VegetableUnit;
import com.tazatokri.combo.Combo;
import com.tazatokri.combo.ComboRepository;
import com.tazatokri.combo.ComboService;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InsufficientStockException;
import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.common.LogScrubber;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.common.SentryErrorReporter;
import com.tazatokri.delivery.DeliveryAttempt;
import com.tazatokri.delivery.DeliveryAttemptRepository;
import com.tazatokri.delivery.DeliveryAuditLog;
import com.tazatokri.delivery.DeliveryAuditLogRepository;
import com.tazatokri.delivery.DeliveryEvidence;
import com.tazatokri.delivery.DeliveryEvidenceRepository;
import com.tazatokri.delivery.DeliveryOtp;
import com.tazatokri.delivery.DeliveryOtpRepository;
import com.tazatokri.delivery.DeliveryRules;
import com.tazatokri.delivery.DeliveryService;
import com.tazatokri.delivery.DeliveryStatus;
import com.tazatokri.delivery.ProofStorageProvider;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.inventory.StockMovement;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.notification.NotificationChannel;
import com.tazatokri.notification.NotificationEventType;
import com.tazatokri.notification.NotificationLanguage;
import com.tazatokri.notification.NotificationLog;
import com.tazatokri.notification.NotificationLogRepository;
import com.tazatokri.notification.NotificationPreference;
import com.tazatokri.notification.NotificationPreferenceRepository;
import com.tazatokri.notification.NotificationService;
import com.tazatokri.notification.NotificationStatus;
import com.tazatokri.notification.OrderMessageTemplates;
import com.tazatokri.notification.WhatsAppCloudApiProvider;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderItemRequest;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.order.OrderResponse;
import com.tazatokri.order.OrderService;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.order.PlaceOrderRequest;
import com.tazatokri.payment.CollectionRequest;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.pricing.PriceSource;
import com.tazatokri.pricing.PricingService;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.purchase.Purchase;
import com.tazatokri.purchase.PurchaseItem;
import com.tazatokri.purchase.PurchaseItemRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.purchase.Supplier;
import com.tazatokri.purchase.SupplierRepository;
import com.tazatokri.report.BusinessIntelligenceReport;
import com.tazatokri.report.DailyReport;
import com.tazatokri.report.ReportService;
import com.tazatokri.report.WastageReport;
import com.tazatokri.sales.Sale;
import com.tazatokri.sales.SaleItem;
import com.tazatokri.sales.SaleItemRequest;
import com.tazatokri.sales.SaleItemRepository;
import com.tazatokri.sales.SalePaymentMethod;
import com.tazatokri.sales.SaleRepository;
import com.tazatokri.sales.SaleRequest;
import com.tazatokri.sales.SaleResponse;
import com.tazatokri.sales.SaleService;
import com.tazatokri.user.Address;
import com.tazatokri.user.AddressRepository;
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

    @Test
    void inventoryAndQuickSaleEnforceStockLimitsIdempotencyAndWastageCostReporting() throws Exception {
        Vegetable tomato = new Vegetable();
        setId(tomato, 10L);
        tomato.setNameEn("Tomato");
        tomato.setNameMr("टोमॅटो");
        tomato.setNameHi("टमाटर");
        tomato.setBaseUnit(UnitType.KG);
        tomato.setActive(true);
        tomato.setAvailable(true);

        User staffUser = new User();
        setId(staffUser, 7L);
        staffUser.setFullName("Ramesh Staff");
        staffUser.setPhone("9876543210");

        List<StockMovement> ledger = new ArrayList<>();
        AtomicLong movSeq = new AtomicLong(1);

        StockMovementRepository movementRepo = stub(StockMovementRepository.class, (proxy, method, args) -> {
            switch (method.getName()) {
                case "currentStock": {
                    Long vegId = (Long) args[0];
                    return ledger.stream()
                            .filter(m -> m.getVegetable().getId().equals(vegId))
                            .map(StockMovement::getQuantity)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                }
                case "save": {
                    StockMovement m = (StockMovement) args[0];
                    setId(m, movSeq.getAndIncrement());
                    Field createdAtField = StockMovement.class.getDeclaredField("createdAt");
                    createdAtField.setAccessible(true);
                    if (createdAtField.get(m) == null) {
                        createdAtField.set(m, LocalDateTime.now());
                    }
                    ledger.add(m);
                    return m;
                }
                case "findWastageMovementsBetween": {
                    return ledger.stream()
                            .filter(m -> m.getType() == MovementType.WASTAGE)
                            .toList();
                }
                default:
                    throw new UnsupportedOperationException(method.getName());
            }
        });

        VegetableRepository vegRepo = stub(VegetableRepository.class, (proxy, method, args) -> {
            if ("findByIdForUpdate".equals(method.getName()) || "findById".equals(method.getName())) {
                Long id = (Long) args[0];
                return id.equals(10L) ? Optional.of(tomato) : Optional.empty();
            }
            throw new UnsupportedOperationException(method.getName());
        });

        UserRepository userRepo = stub(UserRepository.class, (proxy, method, args) -> {
            if ("findByPhone".equals(method.getName())) {
                return Optional.of(staffUser);
            }
            if ("findAllById".equals(method.getName())) {
                return List.of(staffUser);
            }
            throw new UnsupportedOperationException(method.getName());
        });

        InventoryService inventoryService = new InventoryService(movementRepo, vegRepo, userRepo);

        // 1. Add 10 kg purchase stock
        inventoryService.record(10L, MovementType.PURCHASE, new BigDecimal("10.000"),
                "Purchase #1", "PURCHASE", 1L, "9876543210");
        assertEquals(new BigDecimal("10.000"), inventoryService.currentStock(10L));

        // 2. Record 1.5 kg Spoiled wastage & 0.5 kg Damaged wastage
        inventoryService.record(10L, MovementType.WASTAGE, new BigDecimal("1.500"),
                "Spoiled: crate moisture", null, null, "9876543210");
        inventoryService.record(10L, MovementType.WASTAGE, new BigDecimal("0.500"),
                "Damaged: bruised", null, null, "9876543210");
        assertEquals(new BigDecimal("8.000"), inventoryService.currentStock(10L));

        // 3. Reject overselling above 8.000 kg
        assertThrows(InsufficientStockException.class, () ->
                inventoryService.record(10L, MovementType.ONLINE_SALE, new BigDecimal("9.000"),
                        "Order #99", "ORDER", 99L, "9876543210"));
        assertEquals(new BigDecimal("8.000"), inventoryService.currentStock(10L));

        // 4. Quick Sale deduplication via clientRef & stock deduction once
        Map<String, Sale> salesByRef = new LinkedHashMap<>();
        AtomicLong saleSeq = new AtomicLong(50);
        SaleRepository saleRepo = stub(SaleRepository.class, (proxy, method, args) -> {
            switch (method.getName()) {
                case "findWithDetailsByClientRef":
                    return Optional.ofNullable(salesByRef.get((String) args[0]));
                case "save": {
                    Sale s = (Sale) args[0];
                    setId(s, saleSeq.getAndIncrement());
                    salesByRef.put(s.getClientRef(), s);
                    return s;
                }
                case "findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByIdDesc":
                    return new ArrayList<>(salesByRef.values());
                default:
                    throw new UnsupportedOperationException(method.getName());
            }
        });

        VegetablePriceRepository priceRepo = stub(VegetablePriceRepository.class, (proxy, method, args) -> {
            if ("findFirstByVegetableIdOrderByIdDesc".equals(method.getName())) {
                return Optional.of(new VegetablePrice(tomato, new BigDecimal("40.00"),
                        PriceSource.MANUAL, "Counter rate", 7L));
            }
            throw new UnsupportedOperationException(method.getName());
        });

        SaleService saleService = new SaleService(saleRepo, vegRepo, priceRepo, userRepo, inventoryService);
        SaleRequest saleReq = new SaleRequest("sale-ref-abc", SalePaymentMethod.UPI,
                List.of(new SaleItemRequest(10L, new BigDecimal("2.000"))));

        SaleResponse firstSale = saleService.create(saleReq, "9876543210");
        SaleResponse duplicateRetry = saleService.create(saleReq, "9876543210");

        assertEquals(firstSale.id(), duplicateRetry.id(), "Repeated clientRef must return the original sale");
        assertEquals(new BigDecimal("80.00"), firstSale.totalAmount());
        assertEquals(UnitType.KG, firstSale.items().get(0).baseUnit());
        assertEquals(new BigDecimal("6.000"), inventoryService.currentStock(10L), "Stock must be deducted only once");

        // 5. Verify WastageReport calculates loss from actual purchase landed cost (Rs 22/kg), NOT selling price (Rs 40/kg)
        PurchaseItemRepository purchaseItemRepo = stub(PurchaseItemRepository.class, (proxy, method, args) -> {
            if ("summarizeForVegetables".equals(method.getName())) {
                PurchaseItemRepository.VegetableCostSummary cs = new PurchaseItemRepository.VegetableCostSummary() {
                    @Override
                    public Long getVegetableId() {
                        return 10L;
                    }

                    @Override
                    public BigDecimal getTotalCost() {
                        return new BigDecimal("220.00");
                    }

                    @Override
                    public BigDecimal getTotalQty() {
                        return new BigDecimal("10.000");
                    }
                };
                return List.of(cs);
            }
            throw new UnsupportedOperationException(method.getName());
        });

        ReportService reportService = new ReportService(
                saleRepo,
                stub(SaleItemRepository.class, (p, m, a) -> List.of()),
                stub(PurchaseRepository.class, (p, m, a) -> BigDecimal.ZERO),
                purchaseItemRepo,
                movementRepo,
                vegRepo,
                userRepo);

        WastageReport wastageReport = reportService.wastage(LocalDate.now());
        assertEquals(2, wastageReport.daily().totalEntries());
        // 2.000 kg wasted * Rs 22.00 landed purchase cost/kg = Rs 44.00
        assertEquals(new BigDecimal("44.00"), wastageReport.daily().totalEstimatedLoss());
        assertEquals("Ramesh Staff", wastageReport.entries().get(0).createdByName());
    }

    @Test
    void orderPlacementValidatesMinimumOrderDeliveryFeeAndStockOverselling() {
        Category cat = new Category();
        setId(cat, 1L);
        cat.setName("Everyday Vegetables");
        cat.setActive(true);

        Vegetable potato = new Vegetable();
        setId(potato, 20L);
        potato.setNameEn("Potato (Batata)");
        potato.setNameMr("बटाटा");
        potato.setNameHi("आलू");
        potato.setCategory(cat);
        potato.setBaseUnit(UnitType.KG);
        potato.setActive(true);
        potato.setAvailable(true);

        VegetableUnit oneKg = new VegetableUnit();
        setId(oneKg, 201L);
        oneKg.setVegetable(potato);
        oneKg.setLabel("1kg");
        oneKg.setQuantityInBaseUnit(new BigDecimal("1.000"));
        oneKg.setDefaultOption(true);
        oneKg.setActive(true);
        potato.getUnits().add(oneKg);

        User customer = new User();
        setId(customer, 99L);
        customer.setFullName("Priya Customer");
        customer.setPhone("9123456789");

        Address addr = new Address();
        setId(addr, 501L);
        addr.setUserId(99L);
        addr.setLabel("Home");
        addr.setLine1("Flat 4, Kothrud");
        addr.setPincode("411038");
        addr.setActive(true);

        List<StockMovement> ledger = new ArrayList<>();
        AtomicLong movSeq = new AtomicLong(1);

        StockMovementRepository movementRepo = stub(StockMovementRepository.class, (proxy, method, args) -> {
            switch (method.getName()) {
                case "currentStock": {
                    Long vegId = (Long) args[0];
                    return ledger.stream()
                            .filter(m -> m.getVegetable().getId().equals(vegId))
                            .map(StockMovement::getQuantity)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                }
                case "stockForVegetables": {
                    BigDecimal current = ledger.stream()
                            .map(StockMovement::getQuantity)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    StockMovementRepository.VegetableQty row = new StockMovementRepository.VegetableQty() {
                        @Override
                        public Long getVegetableId() {
                            return 20L;
                        }

                        @Override
                        public String getName() {
                            return "Potato (Batata)";
                        }

                        @Override
                        public BigDecimal getQty() {
                            return current;
                        }
                    };
                    return List.of(row);
                }
                case "save": {
                    StockMovement m = (StockMovement) args[0];
                    setId(m, movSeq.getAndIncrement());
                    ledger.add(m);
                    return m;
                }
                default:
                    throw new UnsupportedOperationException(method.getName());
            }
        });

        VegetableRepository vegRepo = stub(VegetableRepository.class, (proxy, method, args) -> {
            switch (method.getName()) {
                case "findByIdForUpdate":
                case "findById":
                case "findWithDetailsById":
                    return Optional.of(potato);
                case "findByActiveTrueOrderByNameEnAsc":
                    return List.of(potato);
                default:
                    throw new UnsupportedOperationException(method.getName());
            }
        });

        UserRepository userRepo = stub(UserRepository.class, (proxy, method, args) -> {
            if ("findByPhone".equals(method.getName())) {
                return Optional.of(customer);
            }
            throw new UnsupportedOperationException(method.getName());
        });

        AddressRepository addrRepo = stub(AddressRepository.class, (proxy, method, args) -> {
            if ("findByIdAndUserId".equals(method.getName())) {
                return Optional.of(addr);
            }
            throw new UnsupportedOperationException(method.getName());
        });

        VegetablePrice potatoPrice = new VegetablePrice(potato, new BigDecimal("50.00"),
                PriceSource.MANUAL, "Daily price", 1L);
        VegetablePriceRepository priceRepo = stub(VegetablePriceRepository.class, (proxy, method, args) -> {
            if ("findFirstByVegetableIdOrderByIdDesc".equals(method.getName())) {
                return Optional.of(potatoPrice);
            }
            if ("findAllCurrent".equals(method.getName())) {
                return List.of(potatoPrice);
            }
            throw new UnsupportedOperationException(method.getName());
        });

        Map<String, CustomerOrder> ordersByRef = new LinkedHashMap<>();
        AtomicLong orderSeq = new AtomicLong(1000);
        CustomerOrderRepository orderRepo = stub(CustomerOrderRepository.class, (proxy, method, args) -> {
            switch (method.getName()) {
                case "findWithDetailsByClientRef":
                    return Optional.ofNullable(ordersByRef.get((String) args[0]));
                case "save": {
                    CustomerOrder o = (CustomerOrder) args[0];
                    setId(o, orderSeq.getAndIncrement());
                    ordersByRef.put(o.getClientRef(), o);
                    return o;
                }
                default:
                    throw new UnsupportedOperationException(method.getName());
            }
        });

        InventoryService inventoryService = new InventoryService(movementRepo, vegRepo, userRepo);
        // Stock = 5.000 kg (worth Rs 250 at Rs 50/kg)
        inventoryService.record(20L, MovementType.PURCHASE, new BigDecimal("5.000"),
                "Purchase #1", "PURCHASE", 1L, "9123456789");

        // Verify PublicCatalogService exposes exact availableStock
        PublicCatalogService publicCatalogService = new PublicCatalogService(vegRepo, priceRepo, movementRepo);
        List<PublicVegetableResponse> publicList = publicCatalogService.list();
        assertEquals(1, publicList.size());
        assertTrue(publicList.get(0).inStock());
        assertEquals(new BigDecimal("5.000"), publicList.get(0).availableStock());

        DeliveryRules rules = new DeliveryRules(
                List.of("411038", "411001"),
                new BigDecimal("150.00"),
                new BigDecimal("30.00"),
                new BigDecimal("300.00"),
                "18:00");
        assertEquals(BigDecimal.ZERO, rules.feeFor(new BigDecimal("300.00")),
                "Orders of Rs 300 or more must receive free delivery");

        OrderService orderService = new OrderService(
                orderRepo, userRepo, addrRepo, vegRepo, priceRepo, inventoryService, rules);

        // 1. Reject order below Rs 150 minimum (2 kg * Rs 50 = Rs 100 < Rs 150)
        PlaceOrderRequest belowMinReq = new PlaceOrderRequest(
                "order-below-min",
                501L,
                OrderPaymentMethod.COD,
                List.of(new OrderItemRequest(20L, 201L, 2)));
        assertThrows(BadRequestException.class, () -> orderService.place(belowMinReq, "9123456789"));

        // 2. Reject order exceeding available stock (6 kg > 5.000 kg stock)
        PlaceOrderRequest overStockReq = new PlaceOrderRequest(
                "order-over-stock",
                501L,
                OrderPaymentMethod.COD,
                List.of(new OrderItemRequest(20L, 201L, 6)));
        assertThrows(InsufficientStockException.class, () -> orderService.place(overStockReq, "9123456789"));

        // 3. Valid order of 4 kg (Rs 200 subtotal + Rs 30 delivery fee = Rs 230 estimated total)
        PlaceOrderRequest validReq = new PlaceOrderRequest(
                "order-valid-1",
                501L,
                OrderPaymentMethod.COD,
                List.of(new OrderItemRequest(20L, 201L, 4)));
        OrderResponse placed = orderService.place(validReq, "9123456789");
        assertEquals(new BigDecimal("200.00"), placed.subtotal());
        assertEquals(new BigDecimal("30.00"), placed.deliveryFee());
        assertEquals(new BigDecimal("230.00"), placed.estimatedTotal());
        assertEquals(new BigDecimal("1.000"), inventoryService.currentStock(20L));
    }

    @Test
    void whatsappNotificationServiceValidatesConsentTransitionsDuplicatesAndTemplates() {
        User customer = new User();
        setId(customer, 15L);
        customer.setFullName("Anita Deshmukh");
        customer.setPhone("9822011223");

        CustomerOrder order = new CustomerOrder();
        setId(order, 123L);
        order.setCustomerId(15L);
        order.setStatus(OrderStatus.CONFIRMED);
        order.setPaymentMethod(OrderPaymentMethod.COD);
        order.setSubtotal(new BigDecimal("220.00"));
        order.setDeliveryFee(new BigDecimal("30.00"));
        order.setEstimatedTotal(new BigDecimal("250.00"));
        order.setDeliveryAddress("Kothrud, Pune");
        order.setDeliveryPincode("411038");
        order.setDeliveryDate(LocalDate.now());

        Map<Long, NotificationPreference> prefStore = new LinkedHashMap<>();
        List<NotificationLog> logStore = new ArrayList<>();
        AtomicLong logSeq = new AtomicLong(1);

        NotificationPreferenceRepository prefRepo = stub(NotificationPreferenceRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "findByUserId":
                    return Optional.ofNullable(prefStore.get((Long) a[0]));
                case "save": {
                    NotificationPreference np = (NotificationPreference) a[0];
                    if (np.getId() == null) setId(np, 1L);
                    prefStore.put(np.getUserId(), np);
                    return np;
                }
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        NotificationLogRepository logRepo = stub(NotificationLogRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "findByOrderIdAndEventTypeAndChannel": {
                    Long oid = (Long) a[0];
                    NotificationEventType ev = (NotificationEventType) a[1];
                    NotificationChannel ch = (NotificationChannel) a[2];
                    return logStore.stream()
                            .filter(l -> l.getOrderId().equals(oid) && l.getEventType() == ev && l.getChannel() == ch)
                            .findFirst();
                }
                case "save": {
                    NotificationLog nl = (NotificationLog) a[0];
                    setId(nl, logSeq.getAndIncrement());
                    logStore.add(nl);
                    return nl;
                }
                case "findByOrderIdOrderByCreatedAtDescIdDesc":
                    return new ArrayList<>(logStore);
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        CustomerOrderRepository orderRepo = stub(CustomerOrderRepository.class, (p, m, a) -> {
            if ("findWithDetailsById".equals(m.getName()) || "findWithDetailsByIdAndCustomerId".equals(m.getName())) {
                return Optional.of(order);
            }
            throw new UnsupportedOperationException(m.getName());
        });

        UserRepository userRepo = stub(UserRepository.class, (p, m, a) -> {
            if ("findByPhone".equals(m.getName()) || "findById".equals(m.getName())) {
                return Optional.of(customer);
            }
            throw new UnsupportedOperationException(m.getName());
        });

        // Cloud API disabled by default
        WhatsAppCloudApiProvider cloudProvider = new WhatsAppCloudApiProvider(
                false, "", "", "", "v21.0", "");
        assertFalse(cloudProvider.isConfiguredAndEnabled());
        assertEquals(NotificationStatus.SKIPPED_DISABLED,
                cloudProvider.sendTemplateOrText("9822011223", "Test").status());

        NotificationService service = new NotificationService(
                prefRepo, logRepo, orderRepo, userRepo, cloudProvider, "9999999999");

        // 1. Default preference has whatsappOptIn = false (never assumes phone number = consent)
        var initialPref = service.getPreference("9822011223");
        assertFalse(initialPref.whatsappOptIn());
        assertNull(initialPref.consentTimestamp());

        // 2. Reject invalid order status transition (DELIVERED notification when order is CONFIRMED)
        assertThrows(InvalidOrderStateException.class, () ->
                service.triggerOrderEventNotification(123L, NotificationEventType.DELIVERED, null));

        // 3. Opt in with Marathi preference and verify consent timestamp
        var updatedPref = service.updatePreference("9822011223", true, NotificationLanguage.MR);
        assertTrue(updatedPref.whatsappOptIn());
        assertNotNull(updatedPref.consentTimestamp());
        assertEquals(NotificationLanguage.MR, updatedPref.preferredLanguage());

        // 4. Trigger ORDER_CONFIRMED notification and verify Marathi message, wa.me link, and duplicate prevention
        var firstNotif = service.triggerOrderEventNotification(123L, NotificationEventType.ORDER_CONFIRMED, null);
        assertFalse(firstNotif.alreadyNotified());
        assertTrue(firstNotif.customerOptedIn());
        assertEquals(NotificationStatus.PREPARED, firstNotif.deliveryStatus());
        assertTrue(firstNotif.messageText().contains("#123"));
        assertTrue(firstNotif.messageText().contains("Anita Deshmukh"));
        assertTrue(firstNotif.waMeUrl().startsWith("https://wa.me/919822011223?text="));

        var duplicateNotif = service.triggerOrderEventNotification(123L, NotificationEventType.ORDER_CONFIRMED, null);
        assertTrue(duplicateNotif.alreadyNotified(), "Second trigger for same event must be flagged as alreadyNotified");
        assertEquals(1, logStore.size(), "No duplicate notification log row may be created");

        // Verify EN and HI templates
        String enMsg = OrderMessageTemplates.formatOrderMessage(
                NotificationEventType.ORDER_PLACED, NotificationLanguage.EN, 123L, "Anita", new BigDecimal("250.00"));
        String hiMsg = OrderMessageTemplates.formatOrderMessage(
                NotificationEventType.DELIVERED, NotificationLanguage.HI, 123L, "Anita", new BigDecimal("250.00"));
        assertTrue(enMsg.contains("order #123"));
        assertTrue(hiMsg.contains("#123"));
    }

    @Test
    void comboPacksAndSavedRecurringBasketsEnforcePricingStockOwnershipAndReminders() {
        Category cat = new Category();
        setId(cat, 1L);
        cat.setName("Everyday Vegetables");
        cat.setActive(true);

        Vegetable onion = new Vegetable();
        setId(onion, 1L);
        onion.setNameEn("Onion (Kanda)");
        onion.setCategory(cat);
        onion.setBaseUnit(UnitType.KG);
        onion.setActive(true);
        onion.setAvailable(true);
        VegetableUnit onion1Kg = new VegetableUnit();
        setId(onion1Kg, 11L);
        onion1Kg.setVegetable(onion);
        onion1Kg.setLabel("1kg");
        onion1Kg.setQuantityInBaseUnit(new BigDecimal("1.000"));
        onion1Kg.setDefaultOption(true);
        onion1Kg.setActive(true);
        onion.getUnits().add(onion1Kg);

        Vegetable tomato = new Vegetable();
        setId(tomato, 2L);
        tomato.setNameEn("Tomato");
        tomato.setCategory(cat);
        tomato.setBaseUnit(UnitType.KG);
        tomato.setActive(true);
        tomato.setAvailable(true);
        VegetableUnit tomato1Kg = new VegetableUnit();
        setId(tomato1Kg, 22L);
        tomato1Kg.setVegetable(tomato);
        tomato1Kg.setLabel("1kg");
        tomato1Kg.setQuantityInBaseUnit(new BigDecimal("1.000"));
        tomato1Kg.setDefaultOption(true);
        tomato1Kg.setActive(true);
        tomato.getUnits().add(tomato1Kg);

        Map<Long, Vegetable> vegMap = Map.of(1L, onion, 2L, tomato);
        Map<Long, BigDecimal> stockMap = new LinkedHashMap<>(Map.of(
                1L, new BigDecimal("4.000"),
                2L, new BigDecimal("3.000")));

        VegetableRepository vegRepo = stub(VegetableRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "findById":
                case "findByIdForUpdate":
                case "findWithDetailsById":
                    return Optional.ofNullable(vegMap.get((Long) a[0]));
                case "findByActiveTrueOrderByNameEnAsc":
                    return List.of(onion, tomato);
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        VegetablePrice onionPrice = new VegetablePrice(onion, new BigDecimal("40.00"), PriceSource.MANUAL, "rate", 1L);
        VegetablePrice tomatoPrice = new VegetablePrice(tomato, new BigDecimal("50.00"), PriceSource.MANUAL, "rate", 1L);
        VegetablePriceRepository priceRepo = stub(VegetablePriceRepository.class, (p, m, a) -> {
            if ("findAllCurrent".equals(m.getName())) {
                return List.of(onionPrice, tomatoPrice);
            }
            if ("findFirstByVegetableIdOrderByIdDesc".equals(m.getName())) {
                Long id = (Long) a[0];
                return Optional.ofNullable(id.equals(1L) ? onionPrice : id.equals(2L) ? tomatoPrice : null);
            }
            throw new UnsupportedOperationException(m.getName());
        });

        StockMovementRepository movRepo = stub(StockMovementRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "stockForVegetables": {
                    List<StockMovementRepository.VegetableQty> rows = new ArrayList<>();
                    for (Map.Entry<Long, BigDecimal> e : stockMap.entrySet()) {
                        rows.add(new StockMovementRepository.VegetableQty() {
                            @Override public Long getVegetableId() { return e.getKey(); }
                            @Override public String getName() { return vegMap.get(e.getKey()).getNameEn(); }
                            @Override public BigDecimal getQty() { return e.getValue(); }
                        });
                    }
                    return rows;
                }
                case "currentStock":
                    return stockMap.getOrDefault((Long) a[0], BigDecimal.ZERO);
                case "save": {
                    StockMovement sm = (StockMovement) a[0];
                    Long vid = sm.getVegetable().getId();
                    stockMap.put(vid, stockMap.getOrDefault(vid, BigDecimal.ZERO).add(sm.getQuantity()));
                    return sm;
                }
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        Map<Long, Combo> comboStore = new LinkedHashMap<>();
        AtomicLong comboSeq = new AtomicLong(1);
        ComboRepository comboRepo = stub(ComboRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "findByNameEnIgnoreCase": {
                    String n = (String) a[0];
                    return comboStore.values().stream()
                            .filter(c -> c.getNameEn().equalsIgnoreCase(n))
                            .findFirst();
                }
                case "findWithDetailsById":
                    return Optional.ofNullable(comboStore.get((Long) a[0]));
                case "findByActiveTrueOrderByNameEnAsc":
                case "findAllByOrderByNameEnAsc":
                    return new ArrayList<>(comboStore.values());
                case "save": {
                    Combo c = (Combo) a[0];
                    if (c.getId() == null) setId(c, comboSeq.getAndIncrement());
                    comboStore.put(c.getId(), c);
                    return c;
                }
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        ComboService comboService = new ComboService(comboRepo, vegRepo, priceRepo, movRepo);

        // 1. Create a combo with 1kg Onion (Rs 40) + 1kg Tomato (Rs 50) = Rs 90 regular, selling at Rs 75
        var createdCombo = comboService.create(new ComboService.ComboUpsertRequest(
                "Onion Tomato Duo",
                "कांदा टोमॅटो जोडी",
                "प्याज टमाटर कॉम्बो",
                "1kg Onion + 1kg Tomato",
                null,
                null,
                null,
                new BigDecimal("75.00"),
                true,
                List.of(
                        new ComboService.ComboItemInput(1L, "1kg", new BigDecimal("1.000")),
                        new ComboService.ComboItemInput(2L, "1kg", new BigDecimal("1.000")))));

        assertEquals(new BigDecimal("90.00"), createdCombo.regularCombinedPrice());
        assertEquals(new BigDecimal("75.00"), createdCombo.sellingPrice());
        assertEquals(new BigDecimal("15.00"), createdCombo.savingsAmount());
        assertTrue(createdCombo.inStock());
        assertEquals(3, createdCombo.maxAvailableCombos()); // min(4kg Onion, 3kg Tomato) = 3 combos

        // 2. Place an order for 2x "Onion Tomato Duo" combos (2 * Rs 75 = Rs 150 >= minOrder Rs 150)
        User cust1 = new User();
        setId(cust1, 101L);
        cust1.setPhone("9000011111");
        cust1.setFullName("Customer One");

        User cust2 = new User();
        setId(cust2, 102L);
        cust2.setPhone("9000022222");
        cust2.setFullName("Customer Two");

        UserRepository userRepo = stub(UserRepository.class, (p, m, a) -> {
            if ("findByPhone".equals(m.getName())) {
                String ph = (String) a[0];
                return Optional.ofNullable("9000011111".equals(ph) ? cust1 : "9000022222".equals(ph) ? cust2 : null);
            }
            throw new UnsupportedOperationException(m.getName());
        });

        Address addr = new Address();
        setId(addr, 1L);
        addr.setUserId(101L);
        addr.setLine1("Baner");
        addr.setPincode("411038");
        addr.setActive(true);
        AddressRepository addrRepo = stub(AddressRepository.class, (p, m, a) -> Optional.of(addr));

        CustomerOrderRepository orderRepo = stub(CustomerOrderRepository.class, (p, m, a) -> {
            if ("findWithDetailsByClientRef".equals(m.getName())) return Optional.empty();
            if ("save".equals(m.getName())) {
                CustomerOrder o = (CustomerOrder) a[0];
                setId(o, 777L);
                return o;
            }
            throw new UnsupportedOperationException(m.getName());
        });

        InventoryService invService = new InventoryService(movRepo, vegRepo, userRepo);
        DeliveryRules rules = new DeliveryRules(
                List.of("411038"), new BigDecimal("150.00"), new BigDecimal("30.00"), new BigDecimal("300.00"), "18:00");
        OrderService orderService = new OrderService(
                orderRepo, userRepo, addrRepo, vegRepo, priceRepo, invService, rules, comboRepo);

        PlaceOrderRequest comboOrderReq = new PlaceOrderRequest(
                "combo-order-1",
                1L,
                OrderPaymentMethod.COD,
                List.of(),
                List.of(new PlaceOrderRequest.OrderComboRequest(createdCombo.id(), 2)));

        OrderResponse comboOrderRes = orderService.place(comboOrderReq, "9000011111");
        assertEquals(new BigDecimal("150.00"), comboOrderRes.subtotal(), "Order subtotal must equal 2 * Rs 75 combo selling price");
        assertEquals(2, comboOrderRes.items().size(), "Both constituent vegetables must be represented in order items");
        assertEquals(new BigDecimal("2.000"), stockMap.get(1L), "Onion stock reduced from 4.000 to 2.000 kg");
        assertEquals(new BigDecimal("1.000"), stockMap.get(2L), "Tomato stock reduced from 3.000 to 1.000 kg");

        // 3. Updating combo price later does NOT alter the historical order's snapshot subtotal
        comboService.update(createdCombo.id(), new ComboService.ComboUpsertRequest(
                "Onion Tomato Duo", null, null, null, null, null, null,
                new BigDecimal("85.00"), true,
                List.of(
                        new ComboService.ComboItemInput(1L, "1kg", new BigDecimal("1.000")),
                        new ComboService.ComboItemInput(2L, "1kg", new BigDecimal("1.000")))));
        assertEquals(new BigDecimal("150.00"), comboOrderRes.subtotal());

        // 4. Disabled combo is rejected at checkout
        comboService.setAvailable(createdCombo.id(), false);
        assertThrows(BadRequestException.class, () -> orderService.place(
                new PlaceOrderRequest("combo-disabled", 1L, OrderPaymentMethod.COD, List.of(),
                        List.of(new PlaceOrderRequest.OrderComboRequest(createdCombo.id(), 2))),
                "9000011111"));

        // 5. Saved Baskets & Recurring Schedules (ownership & reminder safety)
        Map<Long, SavedBasket> basketStore = new LinkedHashMap<>();
        Map<Long, RecurringBasketSchedule> scheduleStore = new LinkedHashMap<>();
        AtomicLong basketSeq = new AtomicLong(1);
        AtomicLong schedSeq = new AtomicLong(1);

        SavedBasketRepository basketRepo = stub(SavedBasketRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "save": {
                    SavedBasket sb = (SavedBasket) a[0];
                    if (sb.getId() == null) setId(sb, basketSeq.getAndIncrement());
                    basketStore.put(sb.getId(), sb);
                    return sb;
                }
                case "findWithDetailsByIdAndCustomerId": {
                    Long id = (Long) a[0];
                    Long cid = (Long) a[1];
                    return Optional.ofNullable(basketStore.get(id)).filter(b -> b.getCustomerId().equals(cid));
                }
                case "findByCustomerIdOrderByUpdatedAtDescIdDesc": {
                    Long cid = (Long) a[0];
                    return basketStore.values().stream().filter(b -> b.getCustomerId().equals(cid)).toList();
                }
                case "delete": {
                    SavedBasket sb = (SavedBasket) a[0];
                    basketStore.remove(sb.getId());
                    return null;
                }
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        RecurringBasketScheduleRepository schedRepo = stub(RecurringBasketScheduleRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "findByBasketIdAndCustomerId": {
                    Long bid = (Long) a[0];
                    Long cid = (Long) a[1];
                    return Optional.ofNullable(scheduleStore.get(bid)).filter(s -> s.getCustomerId().equals(cid));
                }
                case "findByCustomerId": {
                    Long cid = (Long) a[0];
                    return scheduleStore.values().stream().filter(s -> s.getCustomerId().equals(cid)).toList();
                }
                case "save": {
                    RecurringBasketSchedule s = (RecurringBasketSchedule) a[0];
                    if (s.getId() == null) setId(s, schedSeq.getAndIncrement());
                    scheduleStore.put(s.getBasket().getId(), s);
                    return s;
                }
                case "delete": {
                    RecurringBasketSchedule s = (RecurringBasketSchedule) a[0];
                    scheduleStore.remove(s.getBasket().getId());
                    return null;
                }
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        BasketService basketService = new BasketService(
                basketRepo, schedRepo, vegRepo, priceRepo, movRepo, userRepo);

        var savedBasket = basketService.create(
                new BasketService.BasketUpsertRequest(
                        "Weekly Vegetable Basket",
                        List.of(
                                new BasketService.BasketItemInput(1L, 11L, 1),
                                new BasketService.BasketItemInput(2L, 22L, 2))),
                "9000011111");

        assertEquals("Weekly Vegetable Basket", savedBasket.name());
        // Tomato only has 1.000 kg left in stock, but basket wants 2x 1kg -> Tomato is flagged in unavailableItems!
        assertEquals(List.of("Tomato"), savedBasket.unavailableItems());

        // Customer Two cannot access or delete Customer One's basket
        assertThrows(ResourceNotFoundException.class, () ->
                basketService.delete(savedBasket.id(), "9000022222"));

        // Configure weekly schedule, verify due reminder, pause & resume
        var scheduled = basketService.upsertSchedule(
                savedBasket.id(),
                new BasketService.ScheduleUpsertRequest(ScheduleFrequency.WEEKLY, null),
                "9000011111");
        assertNotNull(scheduled.schedule());
        assertEquals(ScheduleStatus.ACTIVE, scheduled.schedule().status());
        assertTrue(scheduled.schedule().reminderDue());
        assertEquals(1, basketService.listReminders("9000011111").size());

        var paused = basketService.pauseSchedule(savedBasket.id(), "9000011111");
        assertEquals(ScheduleStatus.PAUSED, paused.schedule().status());
        assertEquals(0, basketService.listReminders("9000011111").size());

        var resumed = basketService.resumeSchedule(savedBasket.id(), "9000011111");
        assertEquals(ScheduleStatus.ACTIVE, resumed.schedule().status());
    }

    @Test
    void phase3BusinessIntelligenceFreshnessMarkdownAndAiDraftAssistants() {
        Vegetable onion = new Vegetable();
        setId(onion, 1L);
        onion.setNameEn("Onion");
        onion.setNameMr("कांदा");
        onion.setNameHi("प्याज");
        onion.setBaseUnit(UnitType.KG);
        onion.setActive(true);
        onion.setAvailable(true);

        Vegetable tomato = new Vegetable();
        setId(tomato, 2L);
        tomato.setNameEn("Tomato");
        tomato.setNameMr("टोमॅटो");
        tomato.setNameHi("टमाटर");
        tomato.setBaseUnit(UnitType.KG);
        tomato.setActive(true);
        tomato.setAvailable(true);

        Vegetable coriander = new Vegetable();
        setId(coriander, 3L);
        coriander.setNameEn("Coriander Leaves");
        coriander.setNameMr("कोथिंबीर");
        coriander.setNameHi("हरा धनिया");
        coriander.setBaseUnit(UnitType.BUNCH);
        coriander.setActive(true);
        coriander.setAvailable(true);

        List<Vegetable> activeCatalog = List.of(onion, tomato, coriander);

        // Current stock: Onion = 30 kg, Tomato = 10 kg, Coriander = 0 bunches
        Map<Long, BigDecimal> currentStockMap = new LinkedHashMap<>(Map.of(
                1L, new BigDecimal("30.000"),
                2L, new BigDecimal("10.000"),
                3L, BigDecimal.ZERO));

        StockMovementRepository movRepo = stub(StockMovementRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "currentStock":
                    return currentStockMap.getOrDefault((Long) a[0], BigDecimal.ZERO);
                case "stockForVegetables": {
                    List<StockMovementRepository.VegetableQty> list = new ArrayList<>();
                    for (Vegetable v : activeCatalog) {
                        list.add(new StockMovementRepository.VegetableQty() {
                            @Override public Long getVegetableId() { return v.getId(); }
                            @Override public String getName() { return v.getNameEn(); }
                            @Override public BigDecimal getQty() { return currentStockMap.getOrDefault(v.getId(), BigDecimal.ZERO); }
                        });
                    }
                    return list;
                }
                case "stockForVegetablesBefore": {
                    // Opening stock for Onion = 10.000 kg
                    StockMovementRepository.VegetableQty row = new StockMovementRepository.VegetableQty() {
                        @Override public Long getVegetableId() { return 1L; }
                        @Override public String getName() { return "Onion"; }
                        @Override public BigDecimal getQty() { return new BigDecimal("10.000"); }
                    };
                    return List.of(row);
                }
                case "movementsForVegetablesBetween": {
                    // Onion period movements: +25 PURCHASE, -3 SHOP_SALE, -2 WASTAGE => closing 30.000
                    List<StockMovementRepository.VegetableTypeQty> rows = List.of(
                            new StockMovementRepository.VegetableTypeQty() {
                                @Override public Long getVegetableId() { return 1L; }
                                @Override public MovementType getType() { return MovementType.PURCHASE; }
                                @Override public BigDecimal getQty() { return new BigDecimal("25.000"); }
                            },
                            new StockMovementRepository.VegetableTypeQty() {
                                @Override public Long getVegetableId() { return 1L; }
                                @Override public MovementType getType() { return MovementType.SHOP_SALE; }
                                @Override public BigDecimal getQty() { return new BigDecimal("-3.000"); }
                            },
                            new StockMovementRepository.VegetableTypeQty() {
                                @Override public Long getVegetableId() { return 1L; }
                                @Override public MovementType getType() { return MovementType.WASTAGE; }
                                @Override public BigDecimal getQty() { return new BigDecimal("-2.000"); }
                            });
                    return rows;
                }
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        // Onion has recorded purchase landed cost of Rs 24.00/kg; Tomato & Coriander have no purchase cost (uncosted)
        Supplier supplier = new Supplier();
        setId(supplier, 11L);
        supplier.setName("Shri Ganesh Traders");

        Purchase purchase = new Purchase();
        setId(purchase, 501L);
        purchase.setSupplier(supplier);
        purchase.setPurchaseDate(LocalDate.now().minusDays(2));
        purchase.setTransportCost(new BigDecimal("50.00"));
        purchase.setTotalCost(new BigDecimal("600.00"));

        PurchaseItem batchItem = new PurchaseItem();
        setId(batchItem, 9001L);
        batchItem.setPurchase(purchase);
        batchItem.setVegetable(onion);
        batchItem.setQuantity(new BigDecimal("25.000"));
        batchItem.setRatePerUnit(new BigDecimal("22.00"));
        batchItem.setLineCost(new BigDecimal("550.00"));
        batchItem.setTransportShare(new BigDecimal("50.00"));
        batchItem.setLandedCostPerUnit(new BigDecimal("24.0000"));

        PurchaseItemRepository purchaseItemRepo = stub(PurchaseItemRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "summarizeForVegetables": {
                    PurchaseItemRepository.VegetableCostSummary cs = new PurchaseItemRepository.VegetableCostSummary() {
                        @Override public Long getVegetableId() { return 1L; }
                        @Override public BigDecimal getTotalCost() { return new BigDecimal("600.00"); }
                        @Override public BigDecimal getTotalQty() { return new BigDecimal("25.000"); }
                    };
                    return List.of(cs);
                }
                case "findAllActiveBatchesDesc":
                    return List.of(batchItem);
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        // 1 Counter Sale of 3 kg Onion @ Rs 40/kg = Rs 120
        Sale counterSale = new Sale();
        setId(counterSale, 301L);
        counterSale.setPaymentMethod(SalePaymentMethod.UPI);
        counterSale.setTotalAmount(new BigDecimal("120.00"));
        SaleItem saleLine = new SaleItem();
        saleLine.setSale(counterSale);
        saleLine.setVegetable(onion);
        saleLine.setQuantity(new BigDecimal("3.000"));
        saleLine.setUnitPrice(new BigDecimal("40.00"));
        saleLine.setLineTotal(new BigDecimal("120.00"));
        counterSale.getItems().add(saleLine);

        SaleRepository saleRepo = stub(SaleRepository.class, (p, m, a) -> {
            if ("findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByIdDesc".equals(m.getName())) {
                return List.of(counterSale);
            }
            if ("summarizeByPayment".equals(m.getName())) {
                SaleRepository.PaymentSummary ps = new SaleRepository.PaymentSummary() {
                    @Override public SalePaymentMethod getMethod() { return SalePaymentMethod.UPI; }
                    @Override public Long getBills() { return 1L; }
                    @Override public BigDecimal getTotal() { return new BigDecimal("120.00"); }
                };
                return List.of(ps);
            }
            throw new UnsupportedOperationException(m.getName());
        });

        VegetableRepository vegRepo = stub(VegetableRepository.class, (p, m, a) -> {
            if ("findByActiveTrueOrderByNameEnAsc".equals(m.getName())) {
                return activeCatalog;
            }
            if ("findById".equals(m.getName())) {
                Long id = (Long) a[0];
                return activeCatalog.stream().filter(v -> v.getId().equals(id)).findFirst();
            }
            throw new UnsupportedOperationException(m.getName());
        });

        Map<Long, List<VegetablePrice>> priceHistory = new LinkedHashMap<>();
        priceHistory.put(1L, new ArrayList<>(List.of(
                new VegetablePrice(onion, new BigDecimal("40.00"), PriceSource.MANUAL, "Regular", 1L))));
        priceHistory.put(2L, new ArrayList<>(List.of(
                new VegetablePrice(tomato, new BigDecimal("30.00"), PriceSource.MANUAL, "Regular", 1L))));

        VegetablePriceRepository priceRepo = stub(VegetablePriceRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "findAllCurrent":
                    return List.of(
                            priceHistory.get(1L).get(priceHistory.get(1L).size() - 1),
                            priceHistory.get(2L).get(priceHistory.get(2L).size() - 1));
                case "findFirstByVegetableIdOrderByIdDesc": {
                    List<VegetablePrice> list = priceHistory.getOrDefault((Long) a[0], List.of());
                    return list.isEmpty() ? Optional.empty() : Optional.of(list.get(list.size() - 1));
                }
                case "save": {
                    VegetablePrice vp = (VegetablePrice) a[0];
                    setId(vp, 999L);
                    priceHistory.computeIfAbsent(vp.getVegetable().getId(), k -> new ArrayList<>()).add(vp);
                    return vp;
                }
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        User owner = new User();
        setId(owner, 1L);
        owner.setPhone("9876543210");
        owner.setFullName("Owner");
        UserRepository userRepo = stub(UserRepository.class, (p, m, a) -> Optional.of(owner));

        CustomerOrderRepository orderRepo = stub(CustomerOrderRepository.class, (p, m, a) -> List.of());

        ReportService reportService = new ReportService(
                saleRepo,
                stub(SaleItemRepository.class, (p, m, a) -> List.of()),
                stub(PurchaseRepository.class, (p, m, a) -> BigDecimal.ZERO),
                purchaseItemRepo,
                movRepo,
                vegRepo,
                userRepo,
                orderRepo,
                priceRepo);

        // 1. Verify BusinessIntelligenceReport calculations
        BusinessIntelligenceReport bi = reportService.intelligence(LocalDate.now().minusDays(6), LocalDate.now());
        assertEquals(1, bi.inventoryValuation().costedVegetablesCount());
        assertEquals(2, bi.inventoryValuation().uncostedVegetablesCount(), "Tomato and Coriander have no purchase cost and must not use selling price");
        // 30 kg Onion * Rs 24.00 landed cost = Rs 720.00
        assertEquals(new BigDecimal("720.00"), bi.inventoryValuation().totalEstimatedValue());
        assertNull(bi.inventoryValuation().items().get(1).unitLandedCost(), "Uncosted vegetable must report null landed cost");

        var onionMov = bi.stockMovements().get(0);
        assertEquals(new BigDecimal("10.000"), onionMov.openingStock());
        assertEquals(new BigDecimal("25.000"), onionMov.purchasesQty());
        assertEquals(new BigDecimal("3.000"), onionMov.quickSalesQty());
        assertEquals(new BigDecimal("2.000"), onionMov.wastageQty());
        assertEquals(new BigDecimal("30.000"), onionMov.closingStock());

        // Profitability: Rs 120 revenue - (3 kg * Rs 24 = Rs 72 COGS) = Rs 48 Gross Profit (40.00% margin)
        // Minus 2 kg wastage * Rs 24 = Rs 48 wastage cost => Rs 0.00 net contribution
        assertEquals(new BigDecimal("120.00"), bi.profitability().costedMerchandiseRevenue());
        assertEquals(new BigDecimal("72.00"), bi.profitability().estimatedCogs());
        assertEquals(new BigDecimal("48.00"), bi.profitability().estimatedGrossProfit());
        assertEquals(new BigDecimal("40.00"), bi.profitability().grossMarginPercent());
        assertEquals(new BigDecimal("48.00"), bi.profitability().wastageCost());
        assertEquals(new BigDecimal("0.00"), bi.profitability().estimatedNetContribution());

        // Freshness batches
        assertEquals(1, bi.freshnessBatches().size());
        assertEquals(new BigDecimal("25.000"), bi.freshnessBatches().get(0).estimatedRemainingQuantity());

        // 2. Verify Staff-Controlled Markdown Pricing rules
        PricingService pricingService = new PricingService(
                priceRepo, purchaseItemRepo, vegRepo, userRepo, movRepo,
                7, new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("1"));

        // Block markdown on zero-stock Coriander
        assertThrows(BadRequestException.class, () ->
                pricingService.applyMarkdown(3L, new BigDecimal("10.00"), "End of day clearance", "9876543210"));

        // Block markdown when reason says "Spoiled" (must be recorded as Wastage)
        assertThrows(BadRequestException.class, () ->
                pricingService.applyMarkdown(1L, new BigDecimal("30.00"), "Spoiled leaves", "9876543210"));

        // Block markdown price >= current price (Rs 40.00)
        assertThrows(BadRequestException.class, () ->
                pricingService.applyMarkdown(1L, new BigDecimal("42.00"), "End of day clearance", "9876543210"));

        // Apply valid markdown price (Rs 34.00 < Rs 40.00)
        var markdownRes = pricingService.applyMarkdown(1L, new BigDecimal("34.00"), "Evening freshness clearance", "9876543210");
        assertEquals(new BigDecimal("34.00"), markdownRes.pricePerUnit());
        assertTrue(markdownRes.note().startsWith("Markdown: Evening freshness clearance (was ₹40.00)"));

        // 3. Verify AI Purchase Invoice & Quick Sale List Draft Assistants (Draft-only safety boundary)
        List<AiExtractionLog> auditLogs = new ArrayList<>();
        AiExtractionLogRepository logRepo = stub(AiExtractionLogRepository.class, (p, m, a) -> {
            if ("save".equals(m.getName())) {
                AiExtractionLog l = (AiExtractionLog) a[0];
                auditLogs.add(l);
                return l;
            }
            throw new UnsupportedOperationException(m.getName());
        });
        SupplierRepository supplierRepo = stub(SupplierRepository.class, (p, m, a) -> List.of(supplier));
        GeminiProvider geminiProvider = new GeminiProvider(false, "", "gemini-4-hydrogen", 5242880L, null);

        AiAssistantService aiService = new AiAssistantService(
                geminiProvider, vegRepo, supplierRepo, priceRepo, movRepo, logRepo, userRepo);

        PurchaseInvoiceDraftDto invoiceDraft = aiService.extractPurchaseInvoice(
                null,
                null,
                null,
                "Supplier: Shri Ganesh Traders\nDate: 2026-11-18\nTransport: 100\nTotal: 2500\nKanda | 50 kg | 24 | 1200\nMystery Fruit | 10 kg | 80 | 800",
                "9876543210");

        assertEquals(11L, invoiceDraft.matchedSupplierId());
        assertEquals(new BigDecimal("2000.00"), invoiceDraft.calculatedItemsTotal());
        assertEquals(new BigDecimal("2100.00"), invoiceDraft.calculatedGrandTotal());
        assertTrue(invoiceDraft.totalMismatch(), "Calculated 2100 != Invoice 2500 must flag totalMismatch");
        assertEquals(1, invoiceDraft.unmatchedItemsCount(), "Mystery Fruit must be flagged as unmatched");
        assertEquals("Onion", invoiceDraft.items().get(0).matchedVegetableName());
        assertFalse(invoiceDraft.items().get(1).matched());

        QuickSaleDraftDto qsDraft = aiService.extractQuickSaleList(
                null,
                null,
                null,
                "2 kg कांदा\n500 g tomato\n1 bunch kothimbir",
                "9876543210");

        assertEquals(3, qsDraft.totalExtractedCount());
        assertEquals(3, qsDraft.matchedCount());
        assertEquals(0, qsDraft.unmatchedCount());
        // 500 g tomato converted to 0.500 KG @ Rs 30/kg = Rs 15.00
        assertEquals(new BigDecimal("0.500"), qsDraft.items().get(1).quantity());
        assertEquals(new BigDecimal("15.00"), qsDraft.items().get(1).estimatedLineTotal());
        // Coriander is out of stock (0 bunches) -> stockSufficient = false
        assertFalse(qsDraft.items().get(2).stockSufficient());
        assertEquals(2, auditLogs.size(), "Both AI extractions must record an audit log entry");
    }

    @Test
    void phase4DeliveryOtpProofStorageAndSecurityMonitoring() throws Exception {
        User staff = new User();
        setId(staff, 1L);
        staff.setFullName("Owner Staff");
        staff.setPhone("9999999999");
        staff.setActive(true);
        staff.setRoles(java.util.Set.of(Role.OWNER));

        User driver1 = new User();
        setId(driver1, 2L);
        driver1.setFullName("Sunil Driver");
        driver1.setPhone("9111111111");
        driver1.setActive(true);
        driver1.setRoles(java.util.Set.of(Role.DELIVERY));

        User driver2 = new User();
        setId(driver2, 3L);
        driver2.setFullName("Ajay Driver");
        driver2.setPhone("9222222222");
        driver2.setActive(true);
        driver2.setRoles(java.util.Set.of(Role.DELIVERY));

        User customer = new User();
        setId(customer, 10L);
        customer.setFullName("Anita Customer");
        customer.setPhone("9888888888");
        customer.setActive(true);
        customer.setRoles(java.util.Set.of(Role.CUSTOMER));

        User otherCustomer = new User();
        setId(otherCustomer, 11L);
        otherCustomer.setFullName("Other Customer");
        otherCustomer.setPhone("9777777777");
        otherCustomer.setActive(true);
        otherCustomer.setRoles(java.util.Set.of(Role.CUSTOMER));

        Map<Long, User> userById = Map.of(
                1L, staff,
                2L, driver1,
                3L, driver2,
                10L, customer,
                11L, otherCustomer);

        UserRepository userRepo = stub(UserRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "findByPhone": {
                    String ph = (String) a[0];
                    return userById.values().stream().filter(u -> u.getPhone().equals(ph)).findFirst();
                }
                case "findById":
                    return Optional.ofNullable(userById.get((Long) a[0]));
                case "findAllById":
                    return new ArrayList<>(userById.values());
                case "findActiveByRole":
                    return List.of(driver1, driver2);
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        CustomerOrder order = new CustomerOrder();
        setId(order, 900L);
        order.setCustomerId(10L);
        order.setStatus(OrderStatus.PACKED);
        order.setPaymentMethod(OrderPaymentMethod.COD);
        order.setDeliveryDate(LocalDate.now());
        order.setDeliveryAddress("Flat 5, Kothrud, Pune");
        order.setDeliveryPincode("411038");
        order.setDeliveryInstructions("Leave with security guard");
        order.setSubtotal(new BigDecimal("200.00"));
        order.setDeliveryFee(new BigDecimal("30.00"));
        order.setEstimatedTotal(new BigDecimal("230.00"));
        order.setFinalTotal(new BigDecimal("230.00"));

        CustomerOrderRepository orderRepo = stub(CustomerOrderRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "findByIdForUpdate":
                case "findWithDetailsById":
                    return ((Long) a[0]).equals(900L) ? Optional.of(order) : Optional.empty();
                case "findByDeliveryDateOrderByIdDesc":
                    return List.of(order);
                case "findWithDetailsByIdIn":
                    return List.of(order);
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        List<DeliveryAttempt> attemptStore = new ArrayList<>();
        AtomicLong attemptSeq = new AtomicLong(1);
        DeliveryAttemptRepository attemptRepo = stub(DeliveryAttemptRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "save": {
                    DeliveryAttempt da = (DeliveryAttempt) a[0];
                    if (da.getId() == null) setId(da, attemptSeq.getAndIncrement());
                    attemptStore.removeIf(x -> x.getId().equals(da.getId()));
                    attemptStore.add(da);
                    return da;
                }
                case "findFirstByOrderIdAndStatusIn": {
                    Long oid = (Long) a[0];
                    @SuppressWarnings("unchecked")
                    var statuses = (java.util.Collection<DeliveryStatus>) a[1];
                    return attemptStore.stream()
                            .filter(x -> x.getOrderId().equals(oid) && statuses.contains(x.getStatus()))
                            .findFirst();
                }
                case "findFirstByOrderIdOrderByIdDesc": {
                    Long oid = (Long) a[0];
                    return attemptStore.stream().filter(x -> x.getOrderId().equals(oid))
                            .reduce((first, second) -> second);
                }
                case "findByOrderIdOrderByIdAsc":
                case "findByOrderIdInOrderByIdAsc":
                    return new ArrayList<>(attemptStore);
                case "findByDeliveryUserIdAndStatusInOrderByIdAsc": {
                    Long uid = (Long) a[0];
                    @SuppressWarnings("unchecked")
                    var statuses = (java.util.Collection<DeliveryStatus>) a[1];
                    return attemptStore.stream()
                            .filter(x -> x.getDeliveryUserId().equals(uid) && statuses.contains(x.getStatus()))
                            .toList();
                }
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        List<DeliveryOtp> otpStore = new ArrayList<>();
        AtomicLong otpSeq = new AtomicLong(1);
        DeliveryOtpRepository otpRepo = stub(DeliveryOtpRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "save": {
                    DeliveryOtp o = (DeliveryOtp) a[0];
                    if (o.getId() == null) setId(o, otpSeq.getAndIncrement());
                    otpStore.removeIf(x -> x.getId().equals(o.getId()));
                    otpStore.add(o);
                    return o;
                }
                case "saveAll": {
                    @SuppressWarnings("unchecked")
                    Iterable<DeliveryOtp> items = (Iterable<DeliveryOtp>) a[0];
                    List<DeliveryOtp> out = new ArrayList<>();
                    for (DeliveryOtp item : items) {
                        out.add(item);
                    }
                    return out;
                }
                case "findByOrderIdAndStatus": {
                    Long oid = (Long) a[0];
                    String st = (String) a[1];
                    return otpStore.stream()
                            .filter(x -> x.getOrderId().equals(oid) && st.equals(x.getStatus()))
                            .toList();
                }
                case "findFirstByOrderIdAndStatusOrderByIdDesc": {
                    Long oid = (Long) a[0];
                    String st = (String) a[1];
                    return otpStore.stream()
                            .filter(x -> x.getOrderId().equals(oid) && st.equals(x.getStatus()))
                            .reduce((first, second) -> second);
                }
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        List<DeliveryEvidence> evidenceStore = new ArrayList<>();
        AtomicLong evSeq = new AtomicLong(1);
        DeliveryEvidenceRepository evidenceRepo = stub(DeliveryEvidenceRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "save": {
                    DeliveryEvidence ev = (DeliveryEvidence) a[0];
                    if (ev.getId() == null) setId(ev, evSeq.getAndIncrement());
                    evidenceStore.add(ev);
                    return ev;
                }
                case "findByOrderIdOrderByIdDesc":
                case "findByOrderIdInOrderByIdDesc":
                    return new ArrayList<>(evidenceStore);
                case "findByIdAndOrderId": {
                    Long id = (Long) a[0];
                    Long oid = (Long) a[1];
                    return evidenceStore.stream()
                            .filter(x -> x.getId().equals(id) && x.getOrderId().equals(oid))
                            .findFirst();
                }
                case "existsByDeliveryAttemptId":
                    return !evidenceStore.isEmpty();
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        List<DeliveryAuditLog> auditStore = new ArrayList<>();
        AtomicLong auditSeq = new AtomicLong(1);
        DeliveryAuditLogRepository auditRepo = stub(DeliveryAuditLogRepository.class, (p, m, a) -> {
            switch (m.getName()) {
                case "save": {
                    DeliveryAuditLog l = (DeliveryAuditLog) a[0];
                    setId(l, auditSeq.getAndIncrement());
                    auditStore.add(l);
                    return l;
                }
                case "findByOrderIdOrderByCreatedAtAscIdAsc":
                    return new ArrayList<>(auditStore);
                default:
                    throw new UnsupportedOperationException(m.getName());
            }
        });

        Path tempPodDir = Files.createTempDirectory("tazatokri-pod-test");
        ProofStorageProvider storageProvider = new ProofStorageProvider(
                "LOCAL", tempPodDir.toString(), 5242880L, "", "");

        PaymentRepository paymentRepo = stub(PaymentRepository.class, (p, m, a) -> List.of());
        PaymentService paymentService = new PaymentService(paymentRepo, userRepo) {
            @Override
            public void collectOnDelivery(CustomerOrder o, Long collectorId, CollectionRequest req) {
                // no-op stub for unit test
            }
        };

        DeliveryService deliveryService = new DeliveryService(
                attemptRepo, orderRepo, userRepo, paymentService, paymentRepo,
                otpRepo, evidenceRepo, auditRepo, storageProvider,
                new BCryptPasswordEncoder(),
                new WhatsAppCloudApiProvider(false, "", "", "", "v21.0", ""),
                30, 3, false);

        AtomicReference<String> capturedOtp = new AtomicReference<>();
        deliveryService.setTestOtpCaptureListener((oid, code) -> capturedOtp.set(code));

        // 1. Assign to driver1, then reassign to driver2 -> driver1 attempt becomes UNASSIGNED
        deliveryService.assign(900L, 2L, "9999999999");
        deliveryService.assign(900L, 3L, "9999999999");
        assertEquals(DeliveryStatus.UNASSIGNED, attemptStore.get(0).getStatus());
        assertEquals(DeliveryStatus.ASSIGNED, attemptStore.get(1).getStatus());

        // Driver 1 must no longer be able to start the reassigned order
        assertThrows(ResourceNotFoundException.class, () -> deliveryService.start(900L, "9111111111"));

        // 2. Driver 2 starts delivery
        deliveryService.start(900L, "9222222222");
        assertEquals(OrderStatus.OUT_FOR_DELIVERY, order.getStatus());

        // 3. Cannot mark delivered before OTP verification
        assertThrows(BadRequestException.class, () ->
                deliveryService.deliver(900L, new CollectionRequest(PaymentMethod.CASH, new BigDecimal("230.00"), null), "9222222222"));

        // 4. Issue OTP -> verify OTP is hashed (not plaintext) and masked in response
        var otpResp = deliveryService.issueOtp(900L, "9222222222");
        assertEquals("******8888", otpResp.maskedCustomerPhone());
        assertNotNull(capturedOtp.get());
        assertFalse(otpStore.get(0).getOtpHash().equals(capturedOtp.get()), "OTP must be BCrypt-hashed");

        // 5. Wrong OTP increments failed attempts & locks after maxAttempts=3
        String wrongOtp = capturedOtp.get().equals("000000") ? "111111" : "000000";
        assertThrows(BadRequestException.class, () -> deliveryService.verifyOtp(900L, wrongOtp, "9222222222"));
        assertThrows(BadRequestException.class, () -> deliveryService.verifyOtp(900L, wrongOtp, "9222222222"));
        assertThrows(BadRequestException.class, () -> deliveryService.verifyOtp(900L, wrongOtp, "9222222222"));
        assertEquals("LOCKED", otpStore.get(0).getStatus());

        // 6. Re-issue OTP and verify correct OTP
        deliveryService.issueOtp(900L, "9222222222");
        assertEquals("LOCKED", otpStore.get(0).getStatus());
        assertEquals("ACTIVE", otpStore.get(1).getStatus());
        var verifyResp = deliveryService.verifyOtp(900L, capturedOtp.get(), "9222222222");
        assertTrue(verifyResp.verified());

        // OTP cannot be reused
        assertThrows(BadRequestException.class, () -> deliveryService.verifyOtp(900L, capturedOtp.get(), "9222222222"));

        // 7. Proof of Delivery: reject forged file, accept valid JPEG magic bytes, enforce customer ownership
        assertThrows(BadRequestException.class, () ->
                deliveryService.uploadProofPhoto(900L, "not-an-image".getBytes(), "fake.jpg", "note", "9222222222"));

        byte[] validJpegHeader = new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F', 0, 1 };
        var evResp = deliveryService.uploadProofPhoto(900L, validJpegHeader, "gate.jpg", "Handed to customer", "9222222222");
        assertEquals("image/jpeg", evResp.mimeType());

        // Customer 10 can read their own evidence, Customer 11 is blocked
        assertEquals(1, deliveryService.listEvidences(900L, "9888888888").size());
        assertThrows(ResourceNotFoundException.class, () -> deliveryService.listEvidences(900L, "9777777777"));

        // 8. Complete delivery
        var delivered = deliveryService.deliver(900L, new CollectionRequest(PaymentMethod.CASH, new BigDecimal("230.00"), null), "9222222222");
        assertEquals(DeliveryStatus.DELIVERED, delivered.status());
        assertEquals(OrderStatus.DELIVERED, order.getStatus());
        assertFalse(auditStore.isEmpty());

        // 9. LogScrubber & SentryErrorReporter scrub sensitive secrets
        String scrubbed = LogScrubber.scrub("Bearer abc.def.ghi password=MySecret123 AIzaSyD12345678901234567890");
        assertFalse(scrubbed.contains("MySecret123"));
        assertFalse(scrubbed.contains("abc.def.ghi"));
        assertFalse(scrubbed.contains("AIzaSyD"));

        SentryErrorReporter reporter = new SentryErrorReporter("", "production", 0.2);
        assertFalse(reporter.isEnabled());
        var ev = reporter.captureException("TEST_CAT", "/api/test", new RuntimeException("token=secret999"));
        assertFalse(ev.scrubbedMessage().contains("secret999"));
    }
}
