package com.tazatokri.combo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ComboRepository extends JpaRepository<Combo, Long> {

    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    List<Combo> findByActiveTrueOrderByNameEnAsc();

    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    List<Combo> findAllByOrderByNameEnAsc();

    @EntityGraph(attributePaths = {"items", "items.vegetable"})
    Optional<Combo> findWithDetailsById(Long id);

    Optional<Combo> findByNameEnIgnoreCase(String nameEn);
}
