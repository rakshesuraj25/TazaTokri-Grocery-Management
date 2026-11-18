package com.tazatokri.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record VegetableUpdateRequest(
        @NotBlank(message = "English name is required") @Size(max = 100) String nameEn,
        @Size(max = 100) String nameMr,
        @Size(max = 100) String nameHi,
        @Size(max = 500) String imageUrl,
        @NotNull(message = "Category is required") Long categoryId) {}
