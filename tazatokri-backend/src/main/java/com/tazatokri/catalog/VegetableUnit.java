package com.tazatokri.catalog;

import java.math.BigDecimal;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "vegetable_units",
       uniqueConstraints = @UniqueConstraint(name = "uk_vegetable_units_label",
                                             columnNames = {"vegetable_id", "label"}))
@Getter
@Setter
public class VegetableUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vegetable_id", nullable = false)
    private Vegetable vegetable;

    @Column(nullable = false, length = 30)
    private String label;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal quantityInBaseUnit;

    @Column(nullable = false)
    private boolean defaultOption = false;

    @Column(nullable = false)
    private boolean active = true;
}