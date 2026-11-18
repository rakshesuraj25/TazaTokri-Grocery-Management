package com.tazatokri.sales;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

public record SaleItemRequest(@NotNull Long vegetableId,
		@NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantity) {
}