package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseRepository extends JpaRepository<Purchase, Long> {

    @EntityGraph(attributePaths = {"supplier", "items", "items.vegetable"})
    Optional<Purchase> findWithDetailsById(Long id);

    @EntityGraph(attributePaths = {"supplier", "items", "items.vegetable"})
    Optional<Purchase> findByIdempotencyKey(String idempotencyKey);

    @EntityGraph(attributePaths = {"supplier", "items", "items.vegetable"})
    Page<Purchase> findAllByOrderByPurchaseDateDescIdDesc(Pageable pageable);

    @EntityGraph(attributePaths = {"supplier", "items", "items.vegetable"})
    List<Purchase> findBySupplierIdOrderByPurchaseDateDescIdDesc(Long supplierId);

    @Query("select coalesce(sum(p.totalCost), 0) from Purchase p "
            + "where p.purchaseDate = :date and p.status = com.tazatokri.purchase.PurchaseStatus.COMPLETED")
    BigDecimal totalSpendOn(@Param("date") LocalDate date);

    @Query("select coalesce(sum(p.totalCost), 0) from Purchase p "
            + "where p.purchaseDate >= :from and p.purchaseDate <= :to "
            + "and p.status = com.tazatokri.purchase.PurchaseStatus.COMPLETED")
    BigDecimal totalSpendBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select coalesce(sum(p.totalCost), 0) from Purchase p "
            + "where p.supplier.id = :supplierId and p.status = com.tazatokri.purchase.PurchaseStatus.COMPLETED")
    BigDecimal sumCompletedBySupplier(@Param("supplierId") Long supplierId);

    @Query("select p.supplier.id as supplierId, count(p.id) as purchaseCount, "
            + "coalesce(sum(p.totalCost), 0) as totalPurchases, max(p.purchaseDate) as lastPurchaseDate "
            + "from Purchase p where p.status = com.tazatokri.purchase.PurchaseStatus.COMPLETED "
            + "group by p.supplier.id")
    List<SupplierPurchaseProjection> summarizeAllSupplierPurchases();

    interface SupplierPurchaseProjection {
        Long getSupplierId();
        long getPurchaseCount();
        BigDecimal getTotalPurchases();
        LocalDate getLastPurchaseDate();
    }
}