package com.tazatokri.order;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "orders",
       uniqueConstraints = @UniqueConstraint(name = "uk_orders_client_ref", columnNames = "client_ref"),
       indexes = {
           @Index(name = "idx_orders_customer", columnList = "customer_id, id"),
           @Index(name = "idx_orders_status_date", columnList = "status, delivery_date")
       })
@Getter @Setter
public class CustomerOrder {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_ref", nullable = false, length = 40)
    private String clientRef;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private OrderPaymentMethod paymentMethod;

    @Column(nullable = false)
    private LocalDate deliveryDate;

    @Column(nullable = false, length = 500)
    private String deliveryAddress;       // snapshot text

    @Column(nullable = false, length = 6)
    private String deliveryPincode;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;          // estimated items total

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal deliveryFee;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal estimatedTotal;    // subtotal + fee

    @Column(precision = 12, scale = 2)
    private BigDecimal finalTotal;        // filled at packing (step 18)

    @Column(length = 255)
    private String cancelReason;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void touch() { this.updatedAt = LocalDateTime.now(); }

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();
}