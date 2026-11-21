package com.tazatokri.order;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long> {

    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    Optional<CustomerOrder> findWithDetailsByClientRef(String clientRef);

    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    Optional<CustomerOrder> findWithDetailsByIdAndCustomerId(Long id, Long customerId);

    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    Page<CustomerOrder> findByCustomerId(Long customerId, Pageable pageable);
    
    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    Optional<CustomerOrder> findWithDetailsById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.id = :id")
    Optional<CustomerOrder> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    List<CustomerOrder> findByDeliveryDateOrderByIdDesc(LocalDate date);

    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    List<CustomerOrder> findByDeliveryDateAndStatusOrderByIdDesc(LocalDate date, OrderStatus status);
    
    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    List<CustomerOrder> findWithDetailsByIdIn(Collection<Long> ids);
    
    @Query("""
            select o.id from CustomerOrder o
            where o.status = com.tazatokri.order.OrderStatus.PENDING_PAYMENT
              and o.createdAt < :before
            order by o.id
            """)
     List<Long> findExpiredPendingIds(@Param("before") LocalDateTime before);

    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    @Query("""
            select o from CustomerOrder o
            where o.createdAt >= :from and o.createdAt < :to
              and o.status not in (com.tazatokri.order.OrderStatus.CANCELLED, com.tazatokri.order.OrderStatus.PENDING_PAYMENT)
            order by o.id desc
            """)
    List<CustomerOrder> findValidOrdersBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface StatusSummary {
        OrderStatus getStatus();
        Long getCnt();
        BigDecimal getTotal();
    }

    @Query("""
            select o.status as status, count(o) as cnt,
                   coalesce(sum(coalesce(o.finalTotal, o.estimatedTotal)), 0) as total
            from CustomerOrder o
            where o.createdAt >= :from and o.createdAt < :to
            group by o.status
            """)
    List<StatusSummary> summarizeByStatusBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface DailyOrderSummary {
        Object getDay();
        Long getCnt();
        BigDecimal getTotal();
    }

    @Query("""
            select function('date', o.createdAt) as day, count(o) as cnt,
                   coalesce(sum(coalesce(o.finalTotal, o.estimatedTotal)), 0) as total
            from CustomerOrder o
            where o.createdAt >= :from and o.createdAt < :to
              and o.status not in (com.tazatokri.order.OrderStatus.CANCELLED, com.tazatokri.order.OrderStatus.PENDING_PAYMENT)
            group by function('date', o.createdAt)
            """)
    List<DailyOrderSummary> summarizeDailyValidOrdersBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface OrderItemSummary {
        Long getVegetableId();
        String getName();
        BigDecimal getQty();
        BigDecimal getRevenue();
    }

    @Query("""
            select i.vegetable.id as vegetableId, i.vegetable.nameEn as name,
                   coalesce(sum(coalesce(i.actualQuantity, i.quantity)), 0) as qty,
                   coalesce(sum(coalesce(i.finalLineTotal, i.estimatedLineTotal)), 0) as revenue
            from OrderItem i
            where i.order.createdAt >= :from and i.order.createdAt < :to
              and i.order.status not in (com.tazatokri.order.OrderStatus.CANCELLED, com.tazatokri.order.OrderStatus.PENDING_PAYMENT)
            group by i.vegetable.id, i.vegetable.nameEn
            """)
    List<OrderItemSummary> summarizeValidOrderItemsBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface OrderItemDemand {
        Long getVegetableId();
        Long getOrderCount();
        BigDecimal getQty();
    }

    @Query("""
            select i.vegetable.id as vegetableId,
                   count(distinct i.order.id) as orderCount,
                   coalesce(sum(coalesce(i.actualQuantity, i.quantity)), 0) as qty
            from OrderItem i
            where i.order.createdAt >= :from and i.order.createdAt < :to
              and i.order.status not in (com.tazatokri.order.OrderStatus.CANCELLED, com.tazatokri.order.OrderStatus.PENDING_PAYMENT)
            group by i.vegetable.id
            """)
    List<OrderItemDemand> summarizeValidOrderDemandBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface CustomerOrderMetrics {
        Long getCustomerId();
        Long getTotalOrders();
        BigDecimal getTotalSpend();
        LocalDateTime getFirstOrderAt();
        LocalDateTime getLastOrderAt();
    }

    @Query("""
            select o.customerId as customerId,
                   count(o) as totalOrders,
                   coalesce(sum(coalesce(o.finalTotal, o.estimatedTotal)), 0) as totalSpend,
                   min(o.createdAt) as firstOrderAt,
                   max(o.createdAt) as lastOrderAt
            from CustomerOrder o
            where o.status not in (com.tazatokri.order.OrderStatus.CANCELLED, com.tazatokri.order.OrderStatus.PENDING_PAYMENT)
            group by o.customerId
            """)
    List<CustomerOrderMetrics> summarizeCustomerOrderMetrics();
}