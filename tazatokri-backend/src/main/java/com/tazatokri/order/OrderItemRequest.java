package com.tazatokri.order;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record OrderItemRequest(@NotNull Long vegetableId, @NotNull Long unitId,
		@NotNull @Min(1) @Max(20) Integer count) {
}