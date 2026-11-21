package com.tazatokri.loyalty;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "loyalty_transactions",
        uniqueConstraints = @UniqueConstraint(name = "uk_loyalty_idempotency", columnNames = "idempotency_key"),
        indexes = {
            @Index(name = "idx_loyalty_customer_created", columnList = "customer_id, created_at, id"),
            @Index(name = "idx_loyalty_order", columnList = "order_id"),
            @Index(name = "idx_loyalty_type_created", columnList = "type, created_at")
        })
@Getter
@Setter
public class LoyaltyTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(name = "order_id")
    private Long orderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private LoyaltyTransactionType type;

    @Column(nullable = false)
    private int points;

    @Column(name = "rupee_value", nullable = false, precision = 10, scale = 2)
    private BigDecimal rupeeValue = BigDecimal.ZERO;

    @Column(name = "idempotency_key", nullable = false, length = 80)
    private String idempotencyKey;

    @Column(length = 255)
    private String description;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
