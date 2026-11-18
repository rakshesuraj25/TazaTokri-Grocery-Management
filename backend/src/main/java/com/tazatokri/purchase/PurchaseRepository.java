package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
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

    @EntityGraph(attributePaths = "supplier")
    Page<Purchase> findAllByOrderByPurchaseDateDescIdDesc(Pageable pageable);

    @Query("select coalesce(sum(p.totalCost), 0) from Purchase p where p.purchaseDate = :date")
    BigDecimal totalSpendOn(@Param("date") LocalDate date);
}