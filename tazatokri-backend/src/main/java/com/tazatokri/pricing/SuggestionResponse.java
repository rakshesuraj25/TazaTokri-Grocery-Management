package com.tazatokri.pricing;

import java.math.BigDecimal;

import com.tazatokri.catalog.UnitType;

public record SuggestionResponse(Long vegetableId, String nameEn, UnitType baseUnit,
        int lookbackDays, BigDecimal quantityBought, BigDecimal averageLandedCost,
        BigDecimal wastagePercent, BigDecimal costWithWastage,
        BigDecimal marginPercent, BigDecimal suggestedPrice, BigDecimal currentPrice) {}