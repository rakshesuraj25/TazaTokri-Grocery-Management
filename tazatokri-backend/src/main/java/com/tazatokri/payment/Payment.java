
package com.tazatokri.payment;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
    name = "payments",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uk_payments_provider_payment",
            columnNames = "provider_payment_id"
        )
    },
    indexes = {
        @Index(name = "idx_payments_order", columnList = "order_id"),
        @Index(name = "idx_payments_cash", columnList = "collected_by, settled_at")
    }
)
@Getter
@Setter
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private PaymentKind kind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PaymentStatus status;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "collected_by")
    private Long collectedBy;

    @Column(length = 100)
    private String reference;

    // Razorpay payment ID, set when payment is verified
    @Column(name = "provider_payment_id", length = 40)
    private String providerPaymentId;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime settledAt;

    private Long settledBy;
}
