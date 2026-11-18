package com.tazatokri.combo;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "combos")
public class Combo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name_en", nullable = false, unique = true, length = 100)
    private String nameEn;

    @Column(name = "name_mr", length = 100)
    private String nameMr;

    @Column(name = "name_hi", length = 100)
    private String nameHi;

    @Column(name = "description_en", length = 300)
    private String descriptionEn;

    @Column(name = "description_mr", length = 300)
    private String descriptionMr;

    @Column(name = "description_hi", length = 300)
    private String descriptionHi;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "selling_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal sellingPrice;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private boolean available = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "combo", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ComboItem> items = new ArrayList<>();

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getNameMr() { return nameMr; }
    public void setNameMr(String nameMr) { this.nameMr = nameMr; }
    public String getNameHi() { return nameHi; }
    public void setNameHi(String nameHi) { this.nameHi = nameHi; }
    public String getDescriptionEn() { return descriptionEn; }
    public void setDescriptionEn(String descriptionEn) { this.descriptionEn = descriptionEn; }
    public String getDescriptionMr() { return descriptionMr; }
    public void setDescriptionMr(String descriptionMr) { this.descriptionMr = descriptionMr; }
    public String getDescriptionHi() { return descriptionHi; }
    public void setDescriptionHi(String descriptionHi) { this.descriptionHi = descriptionHi; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public BigDecimal getSellingPrice() { return sellingPrice; }
    public void setSellingPrice(BigDecimal sellingPrice) { this.sellingPrice = sellingPrice; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isAvailable() { return available; }
    public void setAvailable(boolean available) { this.available = available; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public List<ComboItem> getItems() { return items; }
}
