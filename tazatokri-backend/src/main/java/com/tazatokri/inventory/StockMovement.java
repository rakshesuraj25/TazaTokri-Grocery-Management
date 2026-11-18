package com.tazatokri.inventory;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.Immutable;

import com.tazatokri.catalog.Vegetable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "stock_movements",
       indexes = @Index(name = "idx_stock_veg_created", columnList = "vegetable_id, created_at"))
@Immutable
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vegetable_id", nullable = false)
    private Vegetable vegetable;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    private MovementType type;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;          // signed, in the vegetable's base unit

    @Column(length = 30)
    private String referenceType;         // e.g. "PURCHASE", "ORDER"

    private Long referenceId;             // id of the purchase/order that caused this

    @Column(length = 255)
    private String note;

    @Column(nullable = false, updatable = false)
    private Long createdBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public StockMovement(Vegetable vegetable, MovementType type, BigDecimal quantity,
                         String referenceType, Long referenceId, String note, Long createdBy) {
        this.vegetable = vegetable;
        this.type = type;
        this.quantity = quantity;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.note = note;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
    }
}