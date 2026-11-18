package com.tazatokri.delivery;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DeliveryEvidenceRepository extends JpaRepository<DeliveryEvidence, Long> {

	List<DeliveryEvidence> findByOrderIdOrderByIdDesc(Long orderId);

	List<DeliveryEvidence> findByOrderIdInOrderByIdDesc(Collection<Long> orderIds);

	Optional<DeliveryEvidence> findByIdAndOrderId(Long id, Long orderId);

	boolean existsByDeliveryAttemptId(Long deliveryAttemptId);
}
