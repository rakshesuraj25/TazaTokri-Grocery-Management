package com.tazatokri.catalog;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;

@RestController
@RequestMapping("/api/staff/catalog")
public class StaffCatalogController {

    private final VegetableRepository vegetables;
    private final VegetablePriceRepository prices;
    private final StockMovementRepository movements;

    public StaffCatalogController(VegetableRepository vegetables,
                                  VegetablePriceRepository prices,
                                  StockMovementRepository movements) {
        this.vegetables = vegetables;
        this.prices = prices;
        this.movements = movements;
    }

    public record StaffCatalogOption(
            Long unitId,
            String label,
            BigDecimal quantityInBaseUnit,
            boolean defaultOption) {}

    public record StaffCatalogItemResponse(
            Long id,
            String nameEn,
            String nameMr,
            String nameHi,
            String imageUrl,
            String category,
            UnitType baseUnit,
            BigDecimal pricePerUnit,
            BigDecimal stock,
            boolean available,
            List<StaffCatalogOption> options) {}

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @Transactional(readOnly = true)
    public List<StaffCatalogItemResponse> list() {
        List<Vegetable> list = vegetables.findByActiveTrueOrderByNameEnAsc();
        if (list.isEmpty()) {
            return List.of();
        }

        Map<Long, BigDecimal> priceById = new HashMap<>();
        for (VegetablePrice p : prices.findAllCurrent()) {
            priceById.put(p.getVegetable().getId(), p.getPricePerUnit());
        }

        Map<Long, BigDecimal> stockById = new HashMap<>();
        movements.stockForVegetables(list.stream().map(Vegetable::getId).toList())
                .forEach(s -> stockById.put(s.getVegetableId(), s.getQty()));

        return list.stream().map(v -> {
            List<StaffCatalogOption> options = v.getUnits().stream()
                    .filter(VegetableUnit::isActive)
                    .map(u -> new StaffCatalogOption(
                            u.getId(),
                            u.getLabel(),
                            u.getQuantityInBaseUnit(),
                            u.isDefaultOption()))
                    .toList();

            return new StaffCatalogItemResponse(
                    v.getId(),
                    v.getNameEn(),
                    v.getNameMr() != null ? v.getNameMr() : "",
                    v.getNameHi() != null ? v.getNameHi() : "",
                    v.getImageUrl(),
                    v.getCategory().getName(),
                    v.getBaseUnit(),
                    priceById.get(v.getId()),
                    stockById.getOrDefault(v.getId(), BigDecimal.ZERO),
                    v.isAvailable(),
                    options);
        }).toList();
    }
}
