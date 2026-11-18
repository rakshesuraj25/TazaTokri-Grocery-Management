package com.tazatokri.purchase;

import java.math.BigDecimal;

import com.tazatokri.catalog.Vegetable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "purchase_items",
       uniqueConstraints = @UniqueConstraint(name = "uk_purchase_veg",
                                             columnNames = {"purchase_id", "vegetable_id"}))
@Getter @Setter
public class PurchaseItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "purchase_id", nullable = false)
    private Purchase purchase;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vegetable_id", nullable = false)
    private Vegetable vegetable;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;            // base unit

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal ratePerUnit;         // price quoted per base unit

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal lineCost;            // quantity x rate

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal transportShare;

    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal landedCostPerUnit;   // (lineCost + transportShare) / quantity
}