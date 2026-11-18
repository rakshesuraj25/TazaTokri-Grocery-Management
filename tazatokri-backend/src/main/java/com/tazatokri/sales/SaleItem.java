package com.tazatokri.sales;

import java.math.BigDecimal;

import com.tazatokri.catalog.Vegetable;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "sale_items",
       uniqueConstraints = @UniqueConstraint(name = "uk_sale_veg",
                                             columnNames = {"sale_id", "vegetable_id"}))
@Getter @Setter
public class SaleItem {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_id", nullable = false)
    private Sale sale;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vegetable_id", nullable = false)
    private Vegetable vegetable;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;        // base unit

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;       // snapshot of the price charged

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal lineTotal;
}