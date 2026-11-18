package com.tazatokri.pricing;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.tazatokri.catalog.UnitType;

public record PriceResponse(Long vegetableId, String nameEn, UnitType baseUnit,
        BigDecimal pricePerUnit, PriceSource source, String note,
        Long createdBy, LocalDateTime createdAt) {

    public static PriceResponse from(VegetablePrice p) {
        return new PriceResponse(p.getVegetable().getId(), p.getVegetable().getNameEn(),
                p.getVegetable().getBaseUnit(), p.getPricePerUnit(), p.getSource(),
                p.getNote(), p.getCreatedBy(), p.getCreatedAt());
    }
}