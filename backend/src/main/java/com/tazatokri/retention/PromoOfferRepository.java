package com.tazatokri.retention;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromoOfferRepository extends JpaRepository<PromoOffer, Long> {

    Optional<PromoOffer> findByCodeIgnoreCase(String code);

    @Query(value = "SELECT * FROM promo_offers WHERE UPPER(code) = UPPER(:code) FOR UPDATE", nativeQuery = true)
    Optional<PromoOffer> findByCodeIgnoreCaseForUpdate(@Param("code") String code);

    @Query(value = "SELECT * FROM promo_offers WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<PromoOffer> findByIdForUpdate(@Param("id") Long id);

    List<PromoOffer> findAllByOrderByCreatedAtDescIdDesc();
}
