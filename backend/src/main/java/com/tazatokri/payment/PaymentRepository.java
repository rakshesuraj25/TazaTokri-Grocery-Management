
package com.tazatokri.payment;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    interface OrderAmount {
        Long getOrderId();
        BigDecimal getAmount();
    }

    interface PendingCash {
        Long getCollectedBy();
        BigDecimal getTotal();
        Long getBills();
    }

    List<Payment> findByOrderIdOrderByIdAsc(Long orderId);

    // Net paid amount for one order.
    // Successful collections increase paid amount.
    // Successful refunds and pending refunds decrease paid amount.
    @Query("""
        select coalesce(
            sum(
                case
                    when p.kind = com.tazatokri.payment.PaymentKind.COLLECTION
                    then p.amount
                    else -p.amount
                end
            ), 0
        )
        from Payment p
        where p.orderId = :orderId
          and (
              p.status = com.tazatokri.payment.PaymentStatus.SUCCESS
              or (
                  p.kind = com.tazatokri.payment.PaymentKind.REFUND
                  and p.status = com.tazatokri.payment.PaymentStatus.PENDING
              )
          )
        """)
    BigDecimal netPaid(@Param("orderId") Long orderId);

    // Batch net-paid calculation for multiple orders.
    @Query("""
        select p.orderId as orderId,
               sum(
                   case
                       when p.kind = com.tazatokri.payment.PaymentKind.COLLECTION
                       then p.amount
                       else -p.amount
                   end
               ) as amount
        from Payment p
        where p.orderId in :ids
          and (
              p.status = com.tazatokri.payment.PaymentStatus.SUCCESS
              or (
                  p.kind = com.tazatokri.payment.PaymentKind.REFUND
                  and p.status = com.tazatokri.payment.PaymentStatus.PENDING
              )
          )
        group by p.orderId
        """)
    List<OrderAmount> netPaidByOrder(@Param("ids") Collection<Long> ids);

    // Pending cash collected by each delivery person.
    @Query("""
        select p.collectedBy as collectedBy,
               sum(p.amount) as total,
               count(p) as bills
        from Payment p
        where p.method = com.tazatokri.payment.PaymentMethod.CASH
          and p.kind = com.tazatokri.payment.PaymentKind.COLLECTION
          and p.status = com.tazatokri.payment.PaymentStatus.SUCCESS
          and p.settledAt is null
        group by p.collectedBy
        """)
    List<PendingCash> pendingCash();

    // Lock unsettled cash payments during settlement.
    @Query(value = """
        SELECT * FROM payments
        WHERE collected_by = :userId
          AND method = 'CASH'
          AND kind = 'COLLECTION'
          AND status = 'SUCCESS'
          AND settled_at IS NULL
        ORDER BY id
        FOR UPDATE
        """, nativeQuery = true)
    List<Payment> lockUnsettledCash(@Param("userId") Long userId);

    // Find payment using provider reference.
    Optional<Payment> findFirstByMethodAndKindAndReference(
        PaymentMethod method,
        PaymentKind kind,
        String reference
    );

    // Find payment for an order using method, kind and status.
    Optional<Payment> findFirstByOrderIdAndMethodAndKindAndStatus(
        Long orderId,
        PaymentMethod method,
        PaymentKind kind,
        PaymentStatus status
    );

    // Find payments by kind and status.
    List<Payment> findByKindAndStatusOrderByIdAsc(
        PaymentKind kind,
        PaymentStatus status
    );

    // Lock a specific payment row.
    @Query(value = "SELECT * FROM payments WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<Payment> findByIdForUpdate(@Param("id") Long id);

    interface MethodTotal {
        PaymentMethod getMethod();
        Long getBills();
        BigDecimal getTotal();
    }

    @Query("""
        select p.method as method, count(p) as bills, coalesce(sum(p.amount), 0) as total
        from Payment p
        where p.kind = com.tazatokri.payment.PaymentKind.COLLECTION
          and p.status = com.tazatokri.payment.PaymentStatus.SUCCESS
          and p.createdAt >= :from and p.createdAt < :to
        group by p.method
        """)
    List<MethodTotal> sumSuccessfulCollectionsByMethodBetween(
        @Param("from") LocalDateTime from,
        @Param("to") LocalDateTime to
    );

    @Query("""
        select coalesce(sum(p.amount), 0)
        from Payment p
        where p.method = com.tazatokri.payment.PaymentMethod.CASH
          and p.kind = com.tazatokri.payment.PaymentKind.COLLECTION
          and p.status = com.tazatokri.payment.PaymentStatus.SUCCESS
          and p.settledAt >= :from and p.settledAt < :to
        """)
    BigDecimal sumCashSettledBetween(
        @Param("from") LocalDateTime from,
        @Param("to") LocalDateTime to
    );

    @Query("""
        select coalesce(sum(p.amount), 0)
        from Payment p
        where p.method = com.tazatokri.payment.PaymentMethod.CASH
          and p.kind = com.tazatokri.payment.PaymentKind.COLLECTION
          and p.status = com.tazatokri.payment.PaymentStatus.SUCCESS
          and p.settledAt is null
        """)
    BigDecimal sumPendingCashTotal();

    @Query("""
        select coalesce(sum(p.amount), 0)
        from Payment p
        where p.kind = com.tazatokri.payment.PaymentKind.REFUND
          and p.status = com.tazatokri.payment.PaymentStatus.SUCCESS
          and p.method = :method
          and p.createdAt >= :from and p.createdAt < :to
        """)
    BigDecimal sumSuccessfulRefundsByMethodBetween(
        @Param("method") PaymentMethod method,
        @Param("from") LocalDateTime from,
        @Param("to") LocalDateTime to
    );

    interface RiderCashSummary {
        Long getCollectedBy();
        BigDecimal getTotal();
    }

    @Query("""
        select p.collectedBy as collectedBy, coalesce(sum(p.amount), 0) as total
        from Payment p
        where p.method = com.tazatokri.payment.PaymentMethod.CASH
          and p.kind = com.tazatokri.payment.PaymentKind.COLLECTION
          and p.status = com.tazatokri.payment.PaymentStatus.SUCCESS
          and p.collectedBy is not null
        group by p.collectedBy
        """)
    List<RiderCashSummary> sumCashCollectedByRider();

    @Query("""
        select p.collectedBy as collectedBy, coalesce(sum(p.amount), 0) as total
        from Payment p
        where p.method = com.tazatokri.payment.PaymentMethod.CASH
          and p.kind = com.tazatokri.payment.PaymentKind.COLLECTION
          and p.status = com.tazatokri.payment.PaymentStatus.SUCCESS
          and p.collectedBy is not null
          and p.settledAt is not null
        group by p.collectedBy
        """)
    List<RiderCashSummary> sumCashSettledByRider();
}
