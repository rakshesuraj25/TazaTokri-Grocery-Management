package com.tazatokri.delivery;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DeliveryOtpRepository extends JpaRepository<DeliveryOtp, Long> {

	List<DeliveryOtp> findByOrderIdAndStatus(Long orderId, String status);

	Optional<DeliveryOtp> findFirstByOrderIdAndStatusOrderByIdDesc(Long orderId, String status);

	Optional<DeliveryOtp> findFirstByOrderIdOrderByIdDesc(Long orderId);
}
