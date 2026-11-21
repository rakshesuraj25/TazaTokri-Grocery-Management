package com.tazatokri.retention;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PromoRedemptionRepository extends JpaRepository<PromoRedemption, Long> {

    long countByOfferId(Long offerId);

    long countByOfferIdAndCustomerId(Long offerId, Long customerId);

    boolean existsByOrderId(Long orderId);

    Optional<PromoRedemption> findByOrderId(Long orderId);
}
