package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseItemRepository extends JpaRepository<PurchaseItem, Long> {

    interface CostSummary {
        BigDecimal getTotalCost();
        BigDecimal getTotalQty();
    }

    interface VegetableCostSummary {
        Long getVegetableId();
        BigDecimal getTotalCost();
        BigDecimal getTotalQty();
    }

    @Query("""
           select sum(i.lineCost + i.transportShare) as totalCost,
                  sum(i.quantity) as totalQty
           from PurchaseItem i
           where i.vegetable.id = :vegId and i.purchase.purchaseDate >= :since
           """)
    CostSummary summarize(@Param("vegId") Long vegId, @Param("since") LocalDate since);

    @Query("""
           select i.vegetable.id as vegetableId,
                  sum(i.lineCost + i.transportShare) as totalCost,
                  sum(i.quantity) as totalQty
           from PurchaseItem i
           where i.vegetable.id in :vegIds
           group by i.vegetable.id
           """)
    java.util.List<VegetableCostSummary> summarizeForVegetables(@Param("vegIds") java.util.Collection<Long> vegIds);

    @EntityGraph(attributePaths = {"purchase", "purchase.supplier", "vegetable"})
    @Query("""
           select i from PurchaseItem i
           where i.vegetable.active = true
           order by i.purchase.purchaseDate desc, i.id desc
           """)
    java.util.List<PurchaseItem> findAllActiveBatchesDesc();
}