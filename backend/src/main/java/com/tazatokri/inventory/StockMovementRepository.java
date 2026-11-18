package com.tazatokri.inventory;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

	@Query("select coalesce(sum(m.quantity), 0) from StockMovement m where m.vegetable.id = :vegId")
	BigDecimal currentStock(@Param("vegId") Long vegId);

	Page<StockMovement> findByVegetableId(Long vegetableId, Pageable pageable);

	@EntityGraph(attributePaths = "vegetable")
	@Query("""
			select m from StockMovement m
			where m.type = com.tazatokri.inventory.MovementType.WASTAGE
			  and m.createdAt >= :from and m.createdAt < :to
			order by m.createdAt desc, m.id desc
			""")
	List<StockMovement> findWastageMovementsBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

	interface VegetableQty {
		Long getVegetableId();

		String getName();

		BigDecimal getQty();
	}

	@Query("""
			select m.vegetable.id as vegetableId, m.vegetable.nameEn as name,
			       sum(m.quantity) as qty
			from StockMovement m
			where m.type = com.tazatokri.inventory.MovementType.WASTAGE
			  and m.createdAt >= :from and m.createdAt < :to
			group by m.vegetable.id, m.vegetable.nameEn
			order by m.vegetable.nameEn
			""")
	List<VegetableQty> wastageBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

	@Query("""
			select m.vegetable.id as vegetableId, m.vegetable.nameEn as name,
			       sum(m.quantity) as qty
			from StockMovement m
			where m.vegetable.active = true
			group by m.vegetable.id, m.vegetable.nameEn
			order by m.vegetable.nameEn
			""")
	List<VegetableQty> stockOfActiveVegetables();

	@Query("""
			select m.vegetable.id as vegetableId, m.vegetable.nameEn as name,
			       sum(m.quantity) as qty
			from StockMovement m
			where m.vegetable.id in :ids
			group by m.vegetable.id, m.vegetable.nameEn
			""")
	List<VegetableQty> stockForVegetables(@Param("ids") java.util.Collection<Long> ids);

	@Query("""
			select m.vegetable.id as vegetableId, m.vegetable.nameEn as name,
			       sum(m.quantity) as qty
			from StockMovement m
			where m.vegetable.id in :ids and m.createdAt < :before
			group by m.vegetable.id, m.vegetable.nameEn
			""")
	List<VegetableQty> stockForVegetablesBefore(@Param("ids") java.util.Collection<Long> ids,
			@Param("before") LocalDateTime before);

	interface VegetableTypeQty {
		Long getVegetableId();

		MovementType getType();

		BigDecimal getQty();
	}

	@Query("""
			select m.vegetable.id as vegetableId, m.type as type,
			       sum(m.quantity) as qty
			from StockMovement m
			where m.vegetable.id in :ids and m.createdAt >= :from and m.createdAt < :to
			group by m.vegetable.id, m.type
			""")
	List<VegetableTypeQty> movementsForVegetablesBetween(@Param("ids") java.util.Collection<Long> ids,
			@Param("from") LocalDateTime from,
			@Param("to") LocalDateTime to);
}