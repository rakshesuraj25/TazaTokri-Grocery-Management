package com.tazatokri.order;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record PackRequest(@NotEmpty @Valid List<Line> items) {

	public record Line(@NotNull Long vegetableId,
			@NotNull @DecimalMin("0.000") @Digits(integer = 9, fraction = 3) BigDecimal actualQuantity) {
	}
}