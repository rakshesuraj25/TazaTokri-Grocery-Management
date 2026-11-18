package com.tazatokri.payment;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;

public record CollectionRequest(
        PaymentMethod method,
        @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal amountCollected,
        @Size(max = 100) String reference) {}