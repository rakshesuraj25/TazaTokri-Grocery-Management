package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
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

    @Query(value = """
            select p.id from Purchase p
            left join p.supplier s
            where (:supplierId is null or s.id = :supplierId)
              and (:fromDate is null or p.purchaseDate >= :fromDate)
              and (:toDate is null or p.purchaseDate <= :toDate)
              and (:status is null or p.status = :status)
              and (:searchTerm is null
                   or lower(s.name) like concat('%', :searchTerm, '%')
                   or lower(coalesce(p.invoiceNumber, '')) like concat('%', :searchTerm, '%')
                   or lower(coalesce(p.note, '')) like concat('%', :searchTerm, '%')
                   or exists (
                       select 1 from PurchaseItem i
                       where i.purchase = p
                         and lower(i.vegetable.nameEn) like concat('%', :searchTerm, '%')
                   ))
            order by p.purchaseDate desc, p.id desc
            """,
           countQuery = """
            select count(p.id) from Purchase p
            left join p.supplier s
            where (:supplierId is null or s.id = :supplierId)
              and (:fromDate is null or p.purchaseDate >= :fromDate)
              and (:toDate is null or p.purchaseDate <= :toDate)
              and (:status is null or p.status = :status)
              and (:searchTerm is null
                   or lower(s.name) like concat('%', :searchTerm, '%')
                   or lower(coalesce(p.invoiceNumber, '')) like concat('%', :searchTerm, '%')
                   or lower(coalesce(p.note, '')) like concat('%', :searchTerm, '%')
                   or exists (
                       select 1 from PurchaseItem i
                       where i.purchase = p
                         and lower(i.vegetable.nameEn) like concat('%', :searchTerm, '%')
                   ))
            """)
    Page<Long> findFilteredIdsOrderByPurchaseDateDescIdDesc(
            @Param("supplierId") Long supplierId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            @Param("status") PurchaseStatus status,
            @Param("searchTerm") String searchTerm,
            Pageable pageable);

    @EntityGraph(attributePaths = {"supplier", "items", "items.vegetable"})
    List<Purchase> findWithDetailsByIdIn(Collection<Long> ids);

    @EntityGraph(attributePaths = {"supplier"})
    List<Purchase> findTop3ByOrderByPurchaseDateDescIdDesc();

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