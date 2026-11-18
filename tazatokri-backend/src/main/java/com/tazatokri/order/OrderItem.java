package com.tazatokri.order;

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
@Table(name = "order_items", uniqueConstraints = @UniqueConstraint(name = "uk_order_veg", columnNames = { "order_id",
		"vegetable_id" }))
@Getter
@Setter
public class OrderItem {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "order_id", nullable = false)
	private CustomerOrder order;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "vegetable_id", nullable = false)
	private Vegetable vegetable;

	@Column(nullable = false, precision = 12, scale = 3)
	private BigDecimal quantity; // ordered, base unit

	@Column(nullable = false, precision = 10, scale = 2)
	private BigDecimal unitPrice; // price snapshot

	@Column(nullable = false, precision = 12, scale = 2)
	private BigDecimal estimatedLineTotal;

	@Column(precision = 12, scale = 3)
	private BigDecimal actualQuantity; // filled at packing

	@Column(precision = 12, scale = 2)
	private BigDecimal finalLineTotal; // filled at packing
}