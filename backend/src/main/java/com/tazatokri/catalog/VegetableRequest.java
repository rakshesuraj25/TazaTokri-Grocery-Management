package com.tazatokri.catalog;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record VegetableRequest(
        @NotBlank(message = "English name is required") @Size(max = 100) String nameEn,
        @Size(max = 100) String nameMr,
        @Size(max = 100) String nameHi,
        @Size(max = 500) String imageUrl,
        @NotNull(message = "Category is required") Long categoryId,
        @NotNull(message = "Base unit is required") UnitType baseUnit,
        @NotEmpty(message = "At least one selling option is required") @Valid List<UnitRequest> units) {}
