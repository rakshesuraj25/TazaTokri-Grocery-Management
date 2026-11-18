package com.tazatokri.pricing;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface VegetablePriceRepository extends JpaRepository<VegetablePrice, Long> {

    Optional<VegetablePrice> findFirstByVegetableIdOrderByIdDesc(Long vegetableId);

    Page<VegetablePrice> findByVegetableId(Long vegetableId, Pageable pageable);

    // newest row per vegetable; ids only grow, so max(id) = latest
    @Query("""
           select p from VegetablePrice p join fetch p.vegetable
           where p.id in (select max(p2.id) from VegetablePrice p2 group by p2.vegetable.id)
           order by p.vegetable.nameEn
           """)
    List<VegetablePrice> findAllCurrent();
}