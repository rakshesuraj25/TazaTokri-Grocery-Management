package com.tazatokri.sales;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleItemRepository extends JpaRepository<SaleItem, Long> {

    interface TopItem {
        Long getVegetableId();
        String getName();
        BigDecimal getQty();
        BigDecimal getRevenue();
    }

    @Query("""
           select i.vegetable.id as vegetableId, i.vegetable.nameEn as name,
                  sum(i.quantity) as qty, sum(i.lineTotal) as revenue
           from SaleItem i
           where i.sale.createdAt >= :from and i.sale.createdAt < :to
           group by i.vegetable.id, i.vegetable.nameEn
           order by sum(i.lineTotal) desc
           """)
    List<TopItem> topItems(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface ShopSaleDemand {
        Long getVegetableId();
        Long getSaleCount();
        BigDecimal getQty();
    }

    @Query("""
           select i.vegetable.id as vegetableId,
                  count(distinct i.sale.id) as saleCount,
                  coalesce(sum(i.quantity), 0) as qty
           from SaleItem i
           where i.sale.createdAt >= :from and i.sale.createdAt < :to
           group by i.vegetable.id
           """)
    List<ShopSaleDemand> summarizeShopSalesBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}