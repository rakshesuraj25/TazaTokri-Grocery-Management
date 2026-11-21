package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupplierPaymentRepository extends JpaRepository<SupplierPayment, Long> {

    @EntityGraph(attributePaths = {"supplier", "purchase"})
    List<SupplierPayment> findBySupplierIdOrderByPaymentDateDescIdDesc(Long supplierId);

    @EntityGraph(attributePaths = {"supplier", "purchase"})
    List<SupplierPayment> findByPurchaseIdOrderByPaymentDateDescIdDesc(Long purchaseId);

    @EntityGraph(attributePaths = {"supplier", "purchase"})
    Optional<SupplierPayment> findByIdempotencyKey(String idempotencyKey);

    @Query("select coalesce(sum(sp.amount), 0) from SupplierPayment sp where sp.supplier.id = :supplierId")
    BigDecimal sumPaidBySupplier(@Param("supplierId") Long supplierId);

    @Query("select coalesce(sum(sp.amount), 0) from SupplierPayment sp where sp.purchase.id = :purchaseId")
    BigDecimal sumPaidByPurchase(@Param("purchaseId") Long purchaseId);

    @Query("select sp.supplier.id as supplierId, coalesce(sum(sp.amount), 0) as totalPaid "
            + "from SupplierPayment sp group by sp.supplier.id")
    List<SupplierPaidProjection> summarizeAllSupplierPayments();

    interface SupplierPaidProjection {
        Long getSupplierId();
        BigDecimal getTotalPaid();
    }
}
