package com.tazatokri.user;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "addresses",
       indexes = @Index(name = "idx_addresses_user", columnList = "user_id"))
@Getter @Setter
public class Address {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 30)
    private String label;

    @Column(nullable = false, length = 150)
    private String line1;

    @Column(length = 150)
    private String line2;

    @Column(length = 100)
    private String landmark;

    @Column(nullable = false, length = 6)
    private String pincode;

    @Column(name = "delivery_instructions", length = 255)
    private String deliveryInstructions;

    @Column(precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(nullable = false)
    private boolean defaultAddress = false;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}