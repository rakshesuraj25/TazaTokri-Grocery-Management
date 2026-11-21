package com.tazatokri.retention;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface PromoOfferRepository extends JpaRepository<PromoOffer, Long> {

    Optional<PromoOffer> findByCodeIgnoreCase(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from PromoOffer o where upper(o.code) = upper(:code)")
    Optional<PromoOffer> findByCodeIgnoreCaseForUpdate(@Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from PromoOffer o where o.id = :id")
    Optional<PromoOffer> findByIdForUpdate(@Param("id") Long id);

    List<PromoOffer> findAllByOrderByCreatedAtDescIdDesc();
}
