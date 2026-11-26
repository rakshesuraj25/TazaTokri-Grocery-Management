package com.tazatokri.purchase;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);

    @Query(value = "SELECT * FROM suppliers WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<Supplier> findByIdForUpdate(@Param("id") Long id);
}