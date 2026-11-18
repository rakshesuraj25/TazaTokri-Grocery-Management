package com.tazatokri.catalog;

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
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "vegetables", uniqueConstraints = @UniqueConstraint(name = "uk_vegetables_name_en", columnNames = "name_en"))
@Getter
@Setter
public class Vegetable {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "name_en", nullable = false, length = 100)
	private String nameEn;

	@Column(name = "name_mr", length = 100)
	private String nameMr;

	@Column(name = "name_hi", length = 100)
	private String nameHi;

	@Column(length = 500)
	private String imageUrl;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "category_id", nullable = false)
	private Category category;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private UnitType baseUnit;

	@Column(nullable = false)
	private boolean active = true;

	@Column(nullable = false)
	private boolean available = true;

	@OneToMany(mappedBy = "vegetable", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<VegetableUnit> units = new ArrayList<>();

	@Column(nullable = false, updatable = false)
	private LocalDateTime createdAt = LocalDateTime.now();

	@Column(nullable = false)
	private LocalDateTime updatedAt = LocalDateTime.now();

	@PreUpdate
	void touch() {
		this.updatedAt = LocalDateTime.now();
	}
}