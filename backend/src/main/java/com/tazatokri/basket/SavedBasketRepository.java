package com.tazatokri.basket;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedBasketRepository extends JpaRepository<SavedBasket, Long> {

    @EntityGraph(attributePaths = {"items", "items.vegetable", "items.vegetable.units"})
    List<SavedBasket> findByCustomerIdOrderByUpdatedAtDescIdDesc(Long customerId);

    @EntityGraph(attributePaths = {"items", "items.vegetable", "items.vegetable.units"})
    Optional<SavedBasket> findWithDetailsByIdAndCustomerId(Long id, Long customerId);
}
