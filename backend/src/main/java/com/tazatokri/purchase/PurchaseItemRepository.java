package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseItemRepository extends JpaRepository<PurchaseItem, Long> {

    interface CostSummary {
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
}