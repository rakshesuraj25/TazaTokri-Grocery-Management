package com.tazatokri.delivery;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DeliveryAttemptRepository extends JpaRepository<DeliveryAttempt, Long> {

	Optional<DeliveryAttempt> findFirstByOrderIdAndStatusIn(Long orderId, Collection<DeliveryStatus> statuses);

	List<DeliveryAttempt> findByDeliveryUserIdAndStatusInOrderByIdAsc(Long userId, Collection<DeliveryStatus> statuses);

	List<DeliveryAttempt> findByOrderIdOrderByIdAsc(Long orderId);
}