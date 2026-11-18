package com.tazatokri.catalog;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface VegetableRepository extends JpaRepository<Vegetable, Long> {

    boolean existsByNameEnIgnoreCase(String nameEn);

    boolean existsByNameEnIgnoreCaseAndIdNot(String nameEn, Long id);

    @EntityGraph(attributePaths = {"category", "units"})
    Optional<Vegetable> findByNameEnIgnoreCase(String nameEn);

    @EntityGraph(attributePaths = {"category", "units"})
    List<Vegetable> findByActiveTrueOrderByNameEnAsc();

    @EntityGraph(attributePaths = {"category", "units"})
    Optional<Vegetable> findWithDetailsById(Long id);
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from Vegetable v where v.id = :id")
    Optional<Vegetable> findByIdForUpdate(@Param("id") Long id);
}