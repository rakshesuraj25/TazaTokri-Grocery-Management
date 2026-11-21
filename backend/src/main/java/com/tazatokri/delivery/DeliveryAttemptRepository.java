package com.tazatokri.delivery;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DeliveryAttemptRepository extends JpaRepository<DeliveryAttempt, Long> {

	Optional<DeliveryAttempt> findFirstByOrderIdAndStatusIn(Long orderId, Collection<DeliveryStatus> statuses);

	Optional<DeliveryAttempt> findFirstByOrderIdOrderByIdDesc(Long orderId);

	List<DeliveryAttempt> findByOrderIdInOrderByIdAsc(Collection<Long> orderIds);

	List<DeliveryAttempt> findByDeliveryUserIdAndStatusInOrderByIdAsc(Long userId, Collection<DeliveryStatus> statuses);

	List<DeliveryAttempt> findByOrderIdOrderByIdAsc(Long orderId);

	List<DeliveryAttempt> findByDeliveryUserIdOrderByIdDesc(Long deliveryUserId, Pageable pageable);

	interface RiderStatusCount {
		Long getDeliveryUserId();
		DeliveryStatus getStatus();
		Long getCnt();
	}

	@Query("""
			select d.deliveryUserId as deliveryUserId, d.status as status, count(d) as cnt
			from DeliveryAttempt d
			group by d.deliveryUserId, d.status
			""")
	List<RiderStatusCount> summarizeStatusByRider();
}
