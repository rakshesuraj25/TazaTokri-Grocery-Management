package com.tazatokri.sales;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SaleRequest(
        @NotBlank @Size(max = 40) String clientRef,
        @NotNull SalePaymentMethod paymentMethod,
        @NotEmpty @Valid List<SaleItemRequest> items) {}