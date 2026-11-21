package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "purchases",
       uniqueConstraints = @UniqueConstraint(name = "uk_purchases_idempotency_key", columnNames = "idempotency_key"),
       indexes = {
           @Index(name = "idx_purchases_date", columnList = "purchase_date"),
           @Index(name = "idx_purchases_supplier_date", columnList = "supplier_id, purchase_date"),
           @Index(name = "idx_purchases_invoice", columnList = "invoice_number")
       })
@Getter 
@Setter
public class Purchase {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(nullable = false)
    private LocalDate purchaseDate;

    @Column(length = 64)
    private String invoiceNumber;

    @Column(length = 64)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PurchaseStatus status = PurchaseStatus.COMPLETED;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal transportCost;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalCost;          // all lines + transport

    @Column(length = 255)
    private String note;

    @Column
    private LocalDateTime cancelledAt;

    @Column
    private Long cancelledBy;

    @Column(length = 255)
    private String cancelReason;

    @Column(nullable = false, updatable = false)
    private Long createdBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "purchase", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseItem> items = new ArrayList<>();
}