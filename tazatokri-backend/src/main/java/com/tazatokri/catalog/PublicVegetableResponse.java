package com.tazatokri.catalog;

import java.math.BigDecimal;
import java.util.List;

public record PublicVegetableResponse(Long id, String nameEn, String nameMr, String nameHi,
        String imageUrl, String category, UnitType baseUnit, BigDecimal pricePerUnit,
        boolean inStock, List<Option> options) {

    public record Option(Long unitId, String label, BigDecimal quantityInBaseUnit,
                         BigDecimal price, boolean defaultOption) {}
}