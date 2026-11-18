package com.tazatokri.pricing;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.Immutable;

import com.tazatokri.catalog.Vegetable;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "vegetable_prices",
       indexes = @Index(name = "idx_price_veg", columnList = "vegetable_id, id"))
@Immutable
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VegetablePrice {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vegetable_id", nullable = false)
    private Vegetable vegetable;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal pricePerUnit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private PriceSource source;

    @Column(length = 255)
    private String note;

    @Column(nullable = false, updatable = false)
    private Long createdBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public VegetablePrice(Vegetable vegetable, BigDecimal pricePerUnit, PriceSource source,
                          String note, Long createdBy) {
        this.vegetable = vegetable;
        this.pricePerUnit = pricePerUnit;
        this.source = source;
        this.note = note;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
    }
}