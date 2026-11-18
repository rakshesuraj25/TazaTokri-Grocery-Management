package com.tazatokri.catalog;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;

@Service
public class PublicCatalogService {

    private final VegetableRepository vegetables;
    private final VegetablePriceRepository prices;
    private final StockMovementRepository movements;

    public PublicCatalogService(VegetableRepository vegetables, VegetablePriceRepository prices,
                                StockMovementRepository movements) {
        this.vegetables = vegetables;
        this.prices = prices;
        this.movements = movements;
    }

    @Transactional(readOnly = true)
    public List<PublicVegetableResponse> list() {
        // 1 query: active vegetables with category and units
        List<Vegetable> list = vegetables.findByActiveTrueOrderByNameEnAsc();
        if (list.isEmpty()) {
            return List.of();
        }

        // 1 query: current price of every vegetable
        Map<Long, BigDecimal> priceById = new HashMap<>();
        for (VegetablePrice p : prices.findAllCurrent()) {
            priceById.put(p.getVegetable().getId(), p.getPricePerUnit());
        }

        // 1 query: stock for these vegetables
        Map<Long, BigDecimal> stockById = new HashMap<>();
        movements.stockForVegetables(list.stream().map(Vegetable::getId).toList())
                .forEach(s -> stockById.put(s.getVegetableId(), s.getQty()));

        return list.stream()
                .filter(v -> priceById.containsKey(v.getId()))
                .map(v -> toResponse(v, priceById.get(v.getId()),
                        stockById.getOrDefault(v.getId(), BigDecimal.ZERO)))
                .toList();
    }

    private PublicVegetableResponse toResponse(Vegetable v, BigDecimal price, BigDecimal stock) {
        List<PublicVegetableResponse.Option> options = v.getUnits().stream()
                .filter(VegetableUnit::isActive)
                .map(u -> new PublicVegetableResponse.Option(u.getId(), u.getLabel(),
                        u.getQuantityInBaseUnit(),
                        price.multiply(u.getQuantityInBaseUnit()).setScale(2, RoundingMode.HALF_UP),
                        u.isDefaultOption()))
                .toList();

        boolean inStock = v.isAvailable() && stock.signum() > 0;
        String category = v.getCategory().getName();
        return new PublicVegetableResponse(v.getId(), v.getNameEn(), v.getNameMr(), v.getNameHi(),
                v.getImageUrl(), category, v.getBaseUnit(), price, inStock, options);
    }
}