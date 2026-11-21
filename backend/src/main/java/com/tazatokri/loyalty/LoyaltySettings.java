package com.tazatokri.loyalty;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "loyalty_settings")
@Getter
@Setter
public class LoyaltySettings {

    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private boolean enabled = false;

    @Column(name = "points_per_100_inr", nullable = false, precision = 8, scale = 2)
    private BigDecimal pointsPer100Inr = new BigDecimal("5.00");

    @Column(name = "rupees_per_point", nullable = false, precision = 8, scale = 4)
    private BigDecimal rupeesPerPoint = new BigDecimal("1.0000");

    @Column(name = "min_redeem_points", nullable = false)
    private int minRedeemPoints = 50;

    @Column(name = "max_redeem_points_per_order", nullable = false)
    private int maxRedeemPointsPerOrder = 200;

    @Column(name = "expiry_days")
    private Integer expiryDays;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
