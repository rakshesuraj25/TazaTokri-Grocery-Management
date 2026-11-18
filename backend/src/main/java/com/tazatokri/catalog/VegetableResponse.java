package com.tazatokri.catalog;

import java.math.BigDecimal;
import java.util.List;

public record VegetableResponse(Long id, String nameEn, String nameMr, String nameHi,
        String imageUrl, Long categoryId, String categoryName, UnitType baseUnit,
        boolean active, boolean available, List<UnitResponse> units) {

    public record UnitResponse(Long id, String label, BigDecimal quantityInBaseUnit,
                               boolean defaultOption) {}

    public static VegetableResponse from(Vegetable v) {
        List<UnitResponse> units = v.getUnits().stream()
                .filter(VegetableUnit::isActive)
                .map(u -> new UnitResponse(u.getId(), u.getLabel(),
                        u.getQuantityInBaseUnit(), u.isDefaultOption()))
                .toList();
        return new VegetableResponse(v.getId(), v.getNameEn(), v.getNameMr(), v.getNameHi(),
                v.getImageUrl(), v.getCategory().getId(), v.getCategory().getName(),
                v.getBaseUnit(), v.isActive(), v.isAvailable(), units);
    }
}