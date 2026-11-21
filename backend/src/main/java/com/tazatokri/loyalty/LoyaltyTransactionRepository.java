package com.tazatokri.loyalty;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LoyaltyTransactionRepository extends JpaRepository<LoyaltyTransaction, Long> {

    Optional<LoyaltyTransaction> findByIdempotencyKey(String idempotencyKey);

    List<LoyaltyTransaction> findByCustomerIdOrderByCreatedAtDescIdDesc(Long customerId, Pageable pageable);

    List<LoyaltyTransaction> findByOrderIdOrderByIdAsc(Long orderId);

    @Query("""
        select coalesce(sum(t.points), 0)
        from LoyaltyTransaction t
        where t.customerId = :customerId
          and (t.expiresAt is null or t.expiresAt > :now)
        """)
    long sumActivePointsForCustomer(@Param("customerId") Long customerId, @Param("now") LocalDateTime now);

    @Query("""
        select coalesce(sum(t.points), 0)
        from LoyaltyTransaction t
        where (t.expiresAt is null or t.expiresAt > :now)
        """)
    long sumTotalOutstandingPoints(@Param("now") LocalDateTime now);

    @Query("""
        select coalesce(sum(t.points), 0)
        from LoyaltyTransaction t
        where t.type = :type
          and t.createdAt >= :from and t.createdAt < :to
        """)
    long sumPointsByTypeBetween(
            @Param("type") LoyaltyTransactionType type,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query("""
        select count(distinct t.orderId)
        from LoyaltyTransaction t
        where t.type = :type
          and t.orderId is not null
          and t.createdAt >= :from and t.createdAt < :to
        """)
    long countDistinctOrdersByTypeBetween(
            @Param("type") LoyaltyTransactionType type,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    interface CustomerPointsBalance {
        Long getCustomerId();
        Long getBalance();
    }

    @Query("""
        select t.customerId as customerId, coalesce(sum(t.points), 0) as balance
        from LoyaltyTransaction t
        where (t.expiresAt is null or t.expiresAt > :now)
        group by t.customerId
        """)
    List<CustomerPointsBalance> sumActivePointsByCustomer(@Param("now") LocalDateTime now);
}
