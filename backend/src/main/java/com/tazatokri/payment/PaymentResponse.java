package com.tazatokri.payment;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PaymentResponse(Long id, PaymentKind kind, PaymentMethod method,
        PaymentStatus status, BigDecimal amount, Long collectedBy, String reference,
        LocalDateTime createdAt, LocalDateTime settledAt) {

    public static PaymentResponse from(Payment p) {
        return new PaymentResponse(p.getId(), p.getKind(), p.getMethod(), p.getStatus(),
                p.getAmount(), p.getCollectedBy(), p.getReference(), p.getCreatedAt(),
                p.getSettledAt());
    }
}