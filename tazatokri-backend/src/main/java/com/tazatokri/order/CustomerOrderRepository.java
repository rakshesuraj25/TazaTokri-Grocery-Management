package com.tazatokri.order;

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

    Page<CustomerOrder> findByCustomerId(Long customerId, Pageable pageable);
    
    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    Optional<CustomerOrder> findWithDetailsById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.id = :id")
    Optional<CustomerOrder> findByIdForUpdate(@Param("id") Long id);

    List<CustomerOrder> findByDeliveryDateOrderByIdDesc(LocalDate date);

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
}