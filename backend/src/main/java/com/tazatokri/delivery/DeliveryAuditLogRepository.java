package com.tazatokri.delivery;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DeliveryAuditLogRepository extends JpaRepository<DeliveryAuditLog, Long> {

	List<DeliveryAuditLog> findByOrderIdOrderByCreatedAtAscIdAsc(Long orderId);
}
