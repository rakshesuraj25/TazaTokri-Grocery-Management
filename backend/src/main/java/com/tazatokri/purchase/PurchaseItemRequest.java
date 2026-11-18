package com.tazatokri.purchase;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

public record PurchaseItemRequest(
        @NotNull Long vegetableId,
        @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantity,
        @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal ratePerUnit) {}
