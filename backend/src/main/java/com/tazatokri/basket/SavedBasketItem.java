package com.tazatokri.basket;

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
@Table(name = "saved_basket_items")
public class SavedBasketItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "basket_id")
    private SavedBasket basket;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vegetable_id")
    private Vegetable vegetable;

    @Column(name = "unit_id", nullable = false)
    private Long unitId;

    @Column(nullable = false)
    private int count;

    public Long getId() { return id; }
    public SavedBasket getBasket() { return basket; }
    public void setBasket(SavedBasket basket) { this.basket = basket; }
    public Vegetable getVegetable() { return vegetable; }
    public void setVegetable(Vegetable vegetable) { this.vegetable = vegetable; }
    public Long getUnitId() { return unitId; }
    public void setUnitId(Long unitId) { this.unitId = unitId; }
    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }
}
