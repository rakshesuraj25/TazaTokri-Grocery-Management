package com.tazatokri.catalog;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VegetableRepository extends JpaRepository<Vegetable, Long> {

    boolean existsByNameEnIgnoreCase(String nameEn);

    boolean existsByNameEnIgnoreCaseAndIdNot(String nameEn, Long id);

    @EntityGraph(attributePaths = {"category", "units"})
    Optional<Vegetable> findByNameEnIgnoreCase(String nameEn);

    @EntityGraph(attributePaths = {"category", "units"})
    List<Vegetable> findByActiveTrueOrderByNameEnAsc();

    @EntityGraph(attributePaths = {"category", "units"})
    Optional<Vegetable> findWithDetailsById(Long id);
    
    @Query(value = "SELECT * FROM vegetables WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<Vegetable> findByIdForUpdate(@Param("id") Long id);
}