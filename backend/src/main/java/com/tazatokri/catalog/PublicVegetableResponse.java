package com.tazatokri.catalog;

import java.math.BigDecimal;
import java.util.List;

public record PublicVegetableResponse(Long id, String nameEn, String nameMr, String nameHi,
        String imageUrl, String category, UnitType baseUnit, BigDecimal pricePerUnit,
        boolean inStock, BigDecimal availableStock, List<Option> options) {

    public PublicVegetableResponse(Long id, String nameEn, String nameMr, String nameHi,
            String imageUrl, String category, UnitType baseUnit, BigDecimal pricePerUnit,
            boolean inStock, List<Option> options) {
        this(id, nameEn, nameMr, nameHi, imageUrl, category, baseUnit, pricePerUnit,
                inStock, inStock ? BigDecimal.ONE : BigDecimal.ZERO, options);
    }

    public record Option(Long unitId, String label, BigDecimal quantityInBaseUnit,
                         BigDecimal price, boolean defaultOption) {}
}