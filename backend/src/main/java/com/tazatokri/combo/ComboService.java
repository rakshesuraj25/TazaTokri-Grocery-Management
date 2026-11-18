package com.tazatokri.combo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Service
public class ComboService {

    private final ComboRepository combos;
    private final VegetableRepository vegetables;
    private final VegetablePriceRepository prices;
    private final StockMovementRepository movements;

    public ComboService(
            ComboRepository combos,
            VegetableRepository vegetables,
            VegetablePriceRepository prices,
            StockMovementRepository movements) {
        this.combos = combos;
        this.vegetables = vegetables;
        this.prices = prices;
        this.movements = movements;
    }

    public record ComboItemInput(
            @NotNull Long vegetableId,
            @NotBlank @Size(max = 40) String unitLabel,
            @NotNull @DecimalMin("0.001") @Digits(integer = 7, fraction = 3) BigDecimal quantityInBaseUnit) {}

    public record ComboUpsertRequest(
            @NotBlank @Size(max = 100) String nameEn,
            @Size(max = 100) String nameMr,
            @Size(max = 100) String nameHi,
            @Size(max = 300) String descriptionEn,
            @Size(max = 300) String descriptionMr,
            @Size(max = 300) String descriptionHi,
            @Size(max = 500) String imageUrl,
            @NotNull @DecimalMin("1.00") @Digits(integer = 8, fraction = 2) BigDecimal sellingPrice,
            Boolean available,
            @NotEmpty @Valid List<ComboItemInput> items) {}

    public record ComboItemDto(
            Long vegetableId,
            String nameEn,
            String nameMr,
            String nameHi,
            String imageUrl,
            UnitType baseUnit,
            String unitLabel,
            BigDecimal quantityInBaseUnit,
            BigDecimal currentPricePerUnit,
            BigDecimal regularLinePrice,
            boolean inStock) {}

    public record ComboDto(
            Long id,
            String nameEn,
            String nameMr,
            String nameHi,
            String descriptionEn,
            String descriptionMr,
            String descriptionHi,
            String imageUrl,
            BigDecimal sellingPrice,
            BigDecimal regularCombinedPrice,
            BigDecimal savingsAmount,
            boolean active,
            boolean available,
            boolean inStock,
            int maxAvailableCombos,
            List<ComboItemDto> items) {}

    @Transactional(readOnly = true)
    public List<ComboDto> listPublic() {
        List<Combo> activeCombos = combos.findByActiveTrueOrderByNameEnAsc();
        return enrichCombos(activeCombos);
    }

    @Transactional(readOnly = true)
    public List<ComboDto> listStaff() {
        List<Combo> allCombos = combos.findAllByOrderByNameEnAsc();
        return enrichCombos(allCombos);
    }

    @Transactional
    public ComboDto create(ComboUpsertRequest req) {
        String cleanNameEn = req.nameEn().trim();
        if (combos.findByNameEnIgnoreCase(cleanNameEn).isPresent()) {
            throw new DuplicateResourceException("Combo already exists: " + cleanNameEn);
        }

        Combo c = new Combo();
        applyFields(c, req);
        Combo saved = combos.save(c);
        return enrichCombos(List.of(saved)).get(0);
    }

    @Transactional
    public ComboDto update(Long id, ComboUpsertRequest req) {
        Combo c = combos.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Combo not found: " + id));

        String cleanNameEn = req.nameEn().trim();
        combos.findByNameEnIgnoreCase(cleanNameEn)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new DuplicateResourceException("Combo already exists: " + cleanNameEn);
                });

        applyFields(c, req);
        Combo saved = combos.save(c);
        return enrichCombos(List.of(saved)).get(0);
    }

    @Transactional
    public ComboDto setAvailable(Long id, boolean available) {
        Combo c = combos.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Combo not found: " + id));
        c.setAvailable(available);
        return enrichCombos(List.of(combos.save(c))).get(0);
    }

    @Transactional
    public ComboDto setActive(Long id, boolean active) {
        Combo c = combos.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Combo not found: " + id));
        c.setActive(active);
        return enrichCombos(List.of(combos.save(c))).get(0);
    }

    @Transactional
    public List<ComboDto> seedDefaults() {
        List<Vegetable> activeVegs = vegetables.findByActiveTrueOrderByNameEnAsc();
        Map<String, Vegetable> byName = new HashMap<>();
        for (Vegetable v : activeVegs) {
            byName.put(v.getNameEn().toLowerCase(), v);
        }

        createStarterIfAbsent(
                "Daily Cooking Combo",
                "दैनंदिन स्वयंपाक कॉम्बो",
                "दैनिक रसोई कॉम्बो",
                "Everyday kitchen essentials: Onion, Tomato, Potato, Green Chilli & Fresh Coriander.",
                "रोजच्या स्वयंपाकासाठी कांदा, टोमॅटो, बटाटा, हिरवी मिरची आणि कोथिंबीर.",
                "रोज़ाना रसोई के लिए प्याज, टमाटर, आलू, हरी मिर्च और हरा धनिया।",
                new BigDecimal("149.00"),
                List.of(
                        new StarterLine("Onion (Kanda)", "1kg", new BigDecimal("1.000")),
                        new StarterLine("Tomato", "1kg", new BigDecimal("1.000")),
                        new StarterLine("Potato (Batata)", "1kg", new BigDecimal("1.000")),
                        new StarterLine("Green Chilli (Mirchi)", "250g", new BigDecimal("0.250")),
                        new StarterLine("Fresh Coriander", "1 bunch", new BigDecimal("1.000"))),
                byName);

        createStarterIfAbsent(
                "Healthy Green Combo",
                "आरोग्यदायी हिरवा कॉम्बो",
                "हेल्दी ग्रीन कॉम्बो",
                "Iron-rich leafy greens and crisp vegetables: Spinach, Fenugreek, Cucumber & Green Peas.",
                "ताजी हिरवी पालेभाजी आणि फळभाज्या: पालक, मेथी, काकडी आणि मटार.",
                "पौष्टिक हरी सब्ज़ियाँ: पालक, मेथी, खीरा और हरी मटर।",
                new BigDecimal("115.00"),
                List.of(
                        new StarterLine("Spinach (Palak)", "1 bunch", new BigDecimal("1.000")),
                        new StarterLine("Fenugreek (Methi)", "1 bunch", new BigDecimal("1.000")),
                        new StarterLine("Cucumber", "500g", new BigDecimal("0.500")),
                        new StarterLine("Green Peas (Matar)", "500g", new BigDecimal("0.500"))),
                byName);

        createStarterIfAbsent(
                "Family Kitchen Combo",
                "फॅमिली किचन कॉम्बो",
                "फैमिली किचन कॉम्बो",
                "Complete family pack: Onion, Potato, Tomato, Brinjal, Cabbage & Carrot.",
                "संपूर्ण कुटुंबासाठी: कांदा, बटाटा, टोमॅटो, वांगी, कोबी आणि गाजर.",
                "पूरे परिवार के लिए: प्याज, आलू, टमाटर, बैंगन, पत्ता गोभी और गाजर।",
                new BigDecimal("199.00"),
                List.of(
                        new StarterLine("Onion (Kanda)", "1kg", new BigDecimal("1.000")),
                        new StarterLine("Potato (Batata)", "1kg", new BigDecimal("1.000")),
                        new StarterLine("Tomato", "1kg", new BigDecimal("1.000")),
                        new StarterLine("Brinjal (Vangi)", "500g", new BigDecimal("0.500")),
                        new StarterLine("Cabbage", "500g", new BigDecimal("0.500")),
                        new StarterLine("Carrot (Gajar)", "500g", new BigDecimal("0.500"))),
                byName);

        return listStaff();
    }

    private record StarterLine(String nameEn, String unitLabel, BigDecimal qty) {}

    private void createStarterIfAbsent(
            String nameEn,
            String nameMr,
            String nameHi,
            String descEn,
            String descMr,
            String descHi,
            BigDecimal sellingPrice,
            List<StarterLine> lines,
            Map<String, Vegetable> byName) {

        if (combos.findByNameEnIgnoreCase(nameEn).isPresent()) {
            return;
        }

        List<ComboItemInput> inputs = new ArrayList<>();
        for (StarterLine line : lines) {
            Vegetable v = byName.get(line.nameEn().toLowerCase());
            if (v == null) return; // only seed if all constituent vegetables exist
            inputs.add(new ComboItemInput(v.getId(), line.unitLabel(), line.qty()));
        }

        Combo c = new Combo();
        applyFields(c, new ComboUpsertRequest(
                nameEn, nameMr, nameHi, descEn, descMr, descHi, null, sellingPrice, true, inputs));
        combos.save(c);
    }

    private void applyFields(Combo c, ComboUpsertRequest req) {
        if (req.items() == null || req.items().size() < 2) {
            throw new BadRequestException("A combo pack must contain at least 2 vegetables");
        }
        if (req.sellingPrice() == null || req.sellingPrice().signum() <= 0) {
            throw new BadRequestException("Combo selling price must be greater than 0");
        }

        Set<Long> seenVegIds = new HashSet<>();
        List<ComboItem> nextItems = new ArrayList<>();

        for (ComboItemInput input : req.items()) {
            if (!seenVegIds.add(input.vegetableId())) {
                throw new BadRequestException("Duplicate vegetable in combo: " + input.vegetableId());
            }
            if (input.quantityInBaseUnit() == null || input.quantityInBaseUnit().signum() <= 0) {
                throw new BadRequestException("Combo item quantity must be greater than 0");
            }
            Vegetable v = vegetables.findById(input.vegetableId())
                    .orElseThrow(() -> new BadRequestException("Vegetable not found: " + input.vegetableId()));
            if (!v.isActive()) {
                throw new BadRequestException("Cannot include inactive vegetable in combo: " + v.getNameEn());
            }

            ComboItem item = new ComboItem();
            item.setCombo(c);
            item.setVegetable(v);
            item.setUnitLabel(input.unitLabel().trim());
            item.setQuantityInBaseUnit(input.quantityInBaseUnit().setScale(3, RoundingMode.HALF_UP));
            nextItems.add(item);
        }

        c.setNameEn(req.nameEn().trim());
        c.setNameMr(cleanNullable(req.nameMr()));
        c.setNameHi(cleanNullable(req.nameHi()));
        c.setDescriptionEn(cleanNullable(req.descriptionEn()));
        c.setDescriptionMr(cleanNullable(req.descriptionMr()));
        c.setDescriptionHi(cleanNullable(req.descriptionHi()));
        c.setImageUrl(cleanNullable(req.imageUrl()));
        c.setSellingPrice(req.sellingPrice().setScale(2, RoundingMode.HALF_UP));
        if (req.available() != null) {
            c.setAvailable(req.available());
        }

        c.getItems().clear();
        c.getItems().addAll(nextItems);
    }

    private List<ComboDto> enrichCombos(List<Combo> list) {
        if (list.isEmpty()) return List.of();

        Map<Long, BigDecimal> priceByVegId = new HashMap<>();
        for (VegetablePrice p : prices.findAllCurrent()) {
            priceByVegId.put(p.getVegetable().getId(), p.getPricePerUnit());
        }

        Set<Long> allVegIds = new HashSet<>();
        for (Combo c : list) {
            for (ComboItem item : c.getItems()) {
                allVegIds.add(item.getVegetable().getId());
            }
        }

        Map<Long, BigDecimal> stockByVegId = new HashMap<>();
        if (!allVegIds.isEmpty()) {
            movements.stockForVegetables(allVegIds)
                    .forEach(s -> stockByVegId.put(s.getVegetableId(), s.getQty()));
        }

        return list.stream().map(c -> {
            BigDecimal regularSum = BigDecimal.ZERO;
            boolean allPriced = !c.getItems().isEmpty();
            boolean allItemsInStock = !c.getItems().isEmpty();
            int maxCombos = c.getItems().isEmpty() ? 0 : Integer.MAX_VALUE;

            List<ComboItemDto> itemDtos = new ArrayList<>();
            for (ComboItem item : c.getItems()) {
                Vegetable v = item.getVegetable();
                BigDecimal unitPrice = priceByVegId.get(v.getId());
                BigDecimal currentStock = stockByVegId.getOrDefault(v.getId(), BigDecimal.ZERO);
                BigDecimal reqQty = item.getQuantityInBaseUnit();

                boolean vegInStock = v.isActive()
                        && v.isAvailable()
                        && unitPrice != null
                        && currentStock.compareTo(reqQty) >= 0;

                if (!vegInStock) {
                    allItemsInStock = false;
                    maxCombos = 0;
                } else if (reqQty.signum() > 0) {
                    int possibleForVeg = currentStock.divide(reqQty, 0, RoundingMode.DOWN).intValue();
                    maxCombos = Math.min(maxCombos, possibleForVeg);
                }

                BigDecimal linePrice = null;
                if (unitPrice != null) {
                    linePrice = unitPrice.multiply(reqQty).setScale(2, RoundingMode.HALF_UP);
                    regularSum = regularSum.add(linePrice);
                } else {
                    allPriced = false;
                }

                itemDtos.add(new ComboItemDto(
                        v.getId(),
                        v.getNameEn(),
                        v.getNameMr(),
                        v.getNameHi(),
                        v.getImageUrl(),
                        v.getBaseUnit(),
                        item.getUnitLabel(),
                        reqQty,
                        unitPrice,
                        linePrice,
                        vegInStock));
            }

            if (maxCombos == Integer.MAX_VALUE) {
                maxCombos = 0;
            }

            BigDecimal regularCombined = allPriced ? regularSum.setScale(2, RoundingMode.HALF_UP) : null;
            BigDecimal savings = (regularCombined != null && regularCombined.compareTo(c.getSellingPrice()) > 0)
                    ? regularCombined.subtract(c.getSellingPrice()).setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

            boolean comboInStock = c.isActive() && c.isAvailable() && allItemsInStock && maxCombos > 0;

            return new ComboDto(
                    c.getId(),
                    c.getNameEn(),
                    c.getNameMr(),
                    c.getNameHi(),
                    c.getDescriptionEn(),
                    c.getDescriptionMr(),
                    c.getDescriptionHi(),
                    c.getImageUrl(),
                    c.getSellingPrice(),
                    regularCombined,
                    savings,
                    c.isActive(),
                    c.isAvailable(),
                    comboInStock,
                    comboInStock ? maxCombos : 0,
                    itemDtos);
        }).toList();
    }

    private String cleanNullable(String val) {
        return (val == null || val.isBlank()) ? null : val.trim();
    }
}
