package com.tazatokri.combo;

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

@Entity
@Table(name = "combo_items")
public class ComboItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "combo_id")
    private Combo combo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vegetable_id")
    private Vegetable vegetable;

    @Column(name = "unit_label", nullable = false, length = 40)
    private String unitLabel;

    @Column(name = "quantity_in_base_unit", nullable = false, precision = 10, scale = 3)
    private BigDecimal quantityInBaseUnit;

    public Long getId() { return id; }
    public Combo getCombo() { return combo; }
    public void setCombo(Combo combo) { this.combo = combo; }
    public Vegetable getVegetable() { return vegetable; }
    public void setVegetable(Vegetable vegetable) { this.vegetable = vegetable; }
    public String getUnitLabel() { return unitLabel; }
    public void setUnitLabel(String unitLabel) { this.unitLabel = unitLabel; }
    public BigDecimal getQuantityInBaseUnit() { return quantityInBaseUnit; }
    public void setQuantityInBaseUnit(BigDecimal quantityInBaseUnit) { this.quantityInBaseUnit = quantityInBaseUnit; }
}
