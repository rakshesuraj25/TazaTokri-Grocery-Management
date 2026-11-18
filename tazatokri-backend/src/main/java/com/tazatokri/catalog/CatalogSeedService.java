package com.tazatokri.catalog;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.pricing.PriceSource;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class CatalogSeedService {

    public record SeedUnit(String label, BigDecimal quantityInBaseUnit, boolean defaultOption) {}

    public record SeedVegetable(
            String nameEn,
            String nameMr,
            String nameHi,
            String categoryName,
            UnitType baseUnit,
            List<SeedUnit> units,
            BigDecimal samplePrice,
            String priceNote,
            String imageUrl) {}

    public record SeedSummary(
            int categoriesCreated,
            int categoriesReused,
            int vegetablesAdded,
            int vegetablesReused,
            int vegetablesUpdated,
            int pricesCreated,
            int totalVegetables,
            List<String> addedVegetables,
            List<String> reusedVegetables,
            List<String> updatedVegetables,
            List<String> pricedVegetables) {}

    private static final String CAT_LEAFY = "Leafy Greens";
    private static final String CAT_EVERYDAY = "Everyday Vegetables";
    private static final String CAT_ROOTS = "Roots & Tubers";

    public static final String SAMPLE_PRICE_NOTE = "Sample price - replace";

    private static final List<SeedUnit> UNITS_BUNCH_1 = List.of(
            new SeedUnit("1 bunch", new BigDecimal("1.000"), true));

    private static final List<SeedUnit> UNITS_PIECE_1 = List.of(
            new SeedUnit("1 piece", new BigDecimal("1.000"), true));

    private static final List<SeedUnit> UNITS_KG_250_500_1KG = List.of(
            new SeedUnit("250g", new BigDecimal("0.250"), false),
            new SeedUnit("500g", new BigDecimal("0.500"), true),
            new SeedUnit("1kg", new BigDecimal("1.000"), false));

    private static final List<SeedUnit> UNITS_KG_500_1KG = List.of(
            new SeedUnit("500g", new BigDecimal("0.500"), true),
            new SeedUnit("1kg", new BigDecimal("1.000"), false));

    private static final List<SeedUnit> UNITS_KG_100_250_500 = List.of(
            new SeedUnit("100g", new BigDecimal("0.100"), false),
            new SeedUnit("250g", new BigDecimal("0.250"), false),
            new SeedUnit("500g", new BigDecimal("0.500"), true));

    public static final List<SeedVegetable> DEFAULT_VEGETABLES = List.of(
            // A. Leafy Greens (8)
            new SeedVegetable("Fresh Coriander", "कोथिंबीर", "धनिया", CAT_LEAFY, UnitType.BUNCH, UNITS_BUNCH_1, new BigDecimal("15.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Spinach (Palak)", "पालक", "पालक", CAT_LEAFY, UnitType.BUNCH, UNITS_BUNCH_1, new BigDecimal("20.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Fenugreek (Methi)", "मेथी", "मेथी", CAT_LEAFY, UnitType.BUNCH, UNITS_BUNCH_1, new BigDecimal("15.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Mint (Pudina)", "पुदिना", "पुदीना", CAT_LEAFY, UnitType.BUNCH, UNITS_BUNCH_1, new BigDecimal("10.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Amaranth (Math)", "माठ", "चौलाई", CAT_LEAFY, UnitType.BUNCH, UNITS_BUNCH_1, new BigDecimal("20.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Dill Leaves (Shepu)", "शेपू", "सोया साग", CAT_LEAFY, UnitType.BUNCH, UNITS_BUNCH_1, new BigDecimal("15.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Spring Onion", "पातीचा कांदा", "हरा प्याज", CAT_LEAFY, UnitType.BUNCH, UNITS_BUNCH_1, new BigDecimal("20.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Curry Leaves", "कढीपत्ता", "करी पत्ता", CAT_LEAFY, UnitType.BUNCH, UNITS_BUNCH_1, new BigDecimal("10.00"), SAMPLE_PRICE_NOTE, null),

            // B. Everyday Vegetables (17)
            new SeedVegetable("Tomato", "टोमॅटो", "टमाटर", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("40.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Okra (Bhendi)", "भेंडी", "भिंडी", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("48.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Brinjal (Vangi)", "वांगी", "बैंगन", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("40.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Cabbage", "कोबी", "पत्ता गोभी", CAT_EVERYDAY, UnitType.KG, UNITS_KG_500_1KG, new BigDecimal("30.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Cauliflower", "फुलकोबी", "फूलगोभी", CAT_EVERYDAY, UnitType.KG, UNITS_KG_500_1KG, new BigDecimal("40.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Capsicum", "ढोबळी मिरची", "शिमला मिर्च", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("60.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Cucumber", "काकडी", "खीरा", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("35.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Bottle Gourd (Dudhi)", "दुधी भोपळा", "लौकी", CAT_EVERYDAY, UnitType.KG, UNITS_KG_500_1KG, new BigDecimal("30.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Bitter Gourd (Karela)", "कारले", "करेला", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("50.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Ridge Gourd (Dodka)", "दोडका", "तुरई", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("45.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Cluster Beans (Gawar)", "गवार", "ग्वार फली", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("60.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("French Beans", "फरसबी", "फ्रेंच बीन्स", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("60.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Green Peas (Matar)", "हिरवे मटार", "हरी मटर", CAT_EVERYDAY, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("80.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Drumstick (Shevga)", "शेवगा", "सहजन", CAT_EVERYDAY, UnitType.PIECE, UNITS_PIECE_1, new BigDecimal("10.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Raw Banana (Kaccha Kela)", "कच्ची केळी", "कच्चा केला", CAT_EVERYDAY, UnitType.PIECE, UNITS_PIECE_1, new BigDecimal("10.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Lemon (Limbu)", "लिंबू", "नींबू", CAT_EVERYDAY, UnitType.PIECE, UNITS_PIECE_1, new BigDecimal("5.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Green Chilli (Mirchi)", "हिरवी मिरची", "हरी मिर्च", CAT_EVERYDAY, UnitType.KG, UNITS_KG_100_250_500, new BigDecimal("80.00"), SAMPLE_PRICE_NOTE, null),

            // C. Roots & Tubers (11)
            new SeedVegetable("Onion (Kanda)", "कांदा", "प्याज", CAT_ROOTS, UnitType.KG, UNITS_KG_500_1KG, new BigDecimal("35.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Potato (Batata)", "बटाटा", "आलू", CAT_ROOTS, UnitType.KG, UNITS_KG_500_1KG, new BigDecimal("30.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Sweet Potato (Ratale)", "रताळे", "शकरकंद", CAT_ROOTS, UnitType.KG, UNITS_KG_500_1KG, new BigDecimal("40.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Carrot (Gajar)", "गाजर", "गाजर", CAT_ROOTS, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("50.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Beetroot", "बीट", "चुकंदर", CAT_ROOTS, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("40.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Radish (Mula)", "मुळा", "मूली", CAT_ROOTS, UnitType.KG, UNITS_KG_250_500_1KG, new BigDecimal("30.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Ginger (Ale)", "आले", "अदरक", CAT_ROOTS, UnitType.KG, UNITS_KG_100_250_500, new BigDecimal("120.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Garlic (Lasun)", "लसूण", "लहसुन", CAT_ROOTS, UnitType.KG, UNITS_KG_100_250_500, new BigDecimal("160.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Sweet Corn", "स्वीट कॉर्न", "स्वीट कॉर्न", CAT_ROOTS, UnitType.PIECE, UNITS_PIECE_1, new BigDecimal("20.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Yam (Suran)", "सुरण", "जिमीकंद", CAT_ROOTS, UnitType.KG, UNITS_KG_500_1KG, new BigDecimal("50.00"), SAMPLE_PRICE_NOTE, null),
            new SeedVegetable("Pumpkin (Bhopla)", "भोपळा", "कद्दू", CAT_ROOTS, UnitType.KG, UNITS_KG_500_1KG, new BigDecimal("30.00"), SAMPLE_PRICE_NOTE, null)
    );

    private final CategoryRepository categoryRepository;
    private final VegetableRepository vegetableRepository;
    private final VegetablePriceRepository priceRepository;
    private final UserRepository userRepository;

    public CatalogSeedService(CategoryRepository categoryRepository,
                              VegetableRepository vegetableRepository,
                              VegetablePriceRepository priceRepository,
                              UserRepository userRepository) {
        this.categoryRepository = categoryRepository;
        this.vegetableRepository = vegetableRepository;
        this.priceRepository = priceRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public SeedSummary seedDefaultCatalog() {
        return seedDefaultCatalog(false);
    }

    @Transactional
    public SeedSummary seedDefaultCatalog(boolean withSamplePrices) {
        int categoriesCreated = 0;
        int categoriesReused = 0;
        int vegetablesAdded = 0;
        int vegetablesReused = 0;
        int vegetablesUpdated = 0;
        int pricesCreated = 0;

        List<String> addedVegetables = new ArrayList<>();
        List<String> reusedVegetables = new ArrayList<>();
        List<String> updatedVegetables = new ArrayList<>();
        List<String> pricedVegetables = new ArrayList<>();

        Long actorUserId = withSamplePrices ? resolveActorUserId() : null;

        Map<String, Category> categoryByName = new HashMap<>();
        for (String catName : List.of(CAT_LEAFY, CAT_EVERYDAY, CAT_ROOTS)) {
            var existingCat = categoryRepository.findByNameIgnoreCase(VegetableService.normalize(catName));
            if (existingCat.isPresent()) {
                Category c = existingCat.get();
                if (!c.isActive()) {
                    c.setActive(true);
                }
                categoryByName.put(catName, c);
                categoriesReused++;
            } else {
                Category c = new Category();
                c.setName(VegetableService.normalize(catName));
                c.setActive(true);
                categoryByName.put(catName, categoryRepository.save(c));
                categoriesCreated++;
            }
        }

        for (SeedVegetable item : DEFAULT_VEGETABLES) {
            Category category = categoryByName.get(item.categoryName());
            String normalizedEn = VegetableService.normalize(item.nameEn());
            var existingOpt = findExistingVegetable(normalizedEn);

            Vegetable v;
            if (existingOpt.isEmpty()) {
                v = new Vegetable();
                v.setNameEn(normalizedEn);
                v.setNameMr(item.nameMr());
                v.setNameHi(item.nameHi());
                v.setImageUrl(null);
                v.setCategory(category);
                v.setBaseUnit(item.baseUnit());
                v.setActive(true);
                v.setAvailable(true);

                for (SeedUnit su : item.units()) {
                    VegetableUnit unit = new VegetableUnit();
                    unit.setVegetable(v);
                    unit.setLabel(su.label());
                    unit.setQuantityInBaseUnit(su.quantityInBaseUnit());
                    unit.setDefaultOption(su.defaultOption());
                    unit.setActive(true);
                    v.getUnits().add(unit);
                }
                v = vegetableRepository.save(v);
                vegetablesAdded++;
                addedVegetables.add(v.getNameEn());
            } else {
                v = existingOpt.get();
                vegetablesReused++;
                reusedVegetables.add(v.getNameEn());

                boolean changed = false;
                if (!Objects.equals(v.getNameEn(), normalizedEn)) {
                    v.setNameEn(normalizedEn);
                    changed = true;
                }
                if (v.getNameMr() == null || v.getNameMr().isBlank()) {
                    v.setNameMr(item.nameMr());
                    changed = true;
                }
                if (v.getNameHi() == null || v.getNameHi().isBlank()) {
                    v.setNameHi(item.nameHi());
                    changed = true;
                }
                if (v.getCategory() == null) {
                    v.setCategory(category);
                    changed = true;
                }
                if (!v.isActive()) {
                    v.setActive(true);
                    changed = true;
                }

                if (syncMissingUnitsSafely(v, item.units())) {
                    changed = true;
                }

                if (changed) {
                    v = vegetableRepository.save(v);
                    vegetablesUpdated++;
                    updatedVegetables.add(v.getNameEn());
                }
            }

            if (withSamplePrices && item.samplePrice() != null) {
                var existingPrice = priceRepository.findFirstByVegetableIdOrderByIdDesc(v.getId());
                // Never overwrite an existing price
                if (existingPrice.isEmpty()) {
                    priceRepository.save(new VegetablePrice(
                            v,
                            item.samplePrice(),
                            PriceSource.MANUAL,
                            SAMPLE_PRICE_NOTE,
                            actorUserId));
                    pricesCreated++;
                    pricedVegetables.add(v.getNameEn());
                }
            }
        }

        int totalVegetables = vegetableRepository.findByActiveTrueOrderByNameEnAsc().size();
        return new SeedSummary(
                categoriesCreated,
                categoriesReused,
                vegetablesAdded,
                vegetablesReused,
                vegetablesUpdated,
                pricesCreated,
                totalVegetables,
                addedVegetables,
                reusedVegetables,
                updatedVegetables,
                pricedVegetables);
    }

    /**
     * Matches existing vegetables by normalized English name, or by base English name
     * before parentheses (e.g. "Spinach" -> "Spinach (Palak)", "Okra" -> "Okra (Bhendi)").
     */
    private java.util.Optional<Vegetable> findExistingVegetable(String normalizedEn) {
        var exact = vegetableRepository.findByNameEnIgnoreCase(normalizedEn);
        if (exact.isPresent()) {
            return exact;
        }
        int parenIdx = normalizedEn.indexOf('(');
        if (parenIdx > 0) {
            String shortName = normalizedEn.substring(0, parenIdx).trim();
            var shortMatch = vegetableRepository.findByNameEnIgnoreCase(shortName);
            if (shortMatch.isPresent()) {
                return shortMatch;
            }
        }
        if (normalizedEn.equalsIgnoreCase("Fresh Coriander")) {
            return vegetableRepository.findByNameEnIgnoreCase("Coriander");
        }
        return java.util.Optional.empty();
    }

    /**
     * Adds missing selling units without deleting existing units or breaking existing defaults.
     */
    private boolean syncMissingUnitsSafely(Vegetable v, List<SeedUnit> targetUnits) {
        boolean modified = false;
        boolean hasExistingDefault = v.getUnits().stream()
                .anyMatch(u -> u.isActive() && u.isDefaultOption());

        for (SeedUnit su : targetUnits) {
            String normalizedLabel = VegetableService.normalize(su.label());
            VegetableUnit match = v.getUnits().stream()
                    .filter(u -> normalizeUnitLabel(u.getLabel()).equalsIgnoreCase(normalizeUnitLabel(normalizedLabel)))
                    .findFirst()
                    .orElse(null);

            if (match == null) {
                VegetableUnit created = new VegetableUnit();
                created.setVegetable(v);
                created.setLabel(normalizedLabel);
                created.setQuantityInBaseUnit(su.quantityInBaseUnit());
                created.setDefaultOption(!hasExistingDefault && su.defaultOption());
                if (created.isDefaultOption()) {
                    hasExistingDefault = true;
                }
                created.setActive(true);
                v.getUnits().add(created);
                modified = true;
            } else if (!match.isActive()) {
                match.setActive(true);
                modified = true;
            }
        }

        long activeDefaults = v.getUnits().stream()
                .filter(u -> u.isActive() && u.isDefaultOption())
                .count();
        if (activeDefaults == 0 && !v.getUnits().isEmpty()) {
            VegetableUnit preferred = v.getUnits().stream()
                    .filter(u -> u.isActive() && normalizeUnitLabel(u.getLabel()).equalsIgnoreCase("500g"))
                    .findFirst()
                    .orElse(v.getUnits().get(0));
            preferred.setDefaultOption(true);
            modified = true;
        }

        return modified;
    }

    private static String normalizeUnitLabel(String label) {
        return label == null ? "" : label.replaceAll("\\s+", "").toLowerCase();
    }

    private Long resolveActorUserId() {
        List<User> owners = userRepository.findActiveByRole(Role.OWNER);
        if (!owners.isEmpty()) {
            return owners.get(0).getId();
        }
        return userRepository.findAll().stream()
                .map(User::getId)
                .findFirst()
                .orElse(1L);
    }
}
