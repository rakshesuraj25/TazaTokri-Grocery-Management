package com.tazatokri.payment;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;

public record CollectionRequest(
        PaymentMethod method,
        @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal amountCollected,
        @Size(max = 100) String reference,
        @Size(max = 80) String recipientName,
        @Size(max = 255) String deliveryNote) {

    public CollectionRequest(PaymentMethod method, BigDecimal amountCollected, String reference) {
        this(method, amountCollected, reference, null, null);
    }
}
