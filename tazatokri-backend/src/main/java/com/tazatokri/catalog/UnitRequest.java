package com.tazatokri.catalog;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UnitRequest(
        @NotBlank(message = "Unit label is required") @Size(max = 30) String label,
        @NotNull(message = "Quantity is required")
        @DecimalMin(value = "0.001", message = "Quantity must be greater than 0")
        @Digits(integer = 7, fraction = 3) BigDecimal quantityInBaseUnit,
        boolean defaultOption) {}