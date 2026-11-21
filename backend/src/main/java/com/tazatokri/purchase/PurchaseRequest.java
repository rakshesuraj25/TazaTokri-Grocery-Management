package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

public record PurchaseRequest(
        @NotNull Long supplierId,
        @NotNull @PastOrPresent LocalDate purchaseDate,
        @NotNull @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal transportCost,
        @Size(max = 64) String invoiceNumber,
        @Size(max = 64) String idempotencyKey,
        @Size(max = 255) String note,
        @NotEmpty @Valid List<PurchaseItemRequest> items) {}