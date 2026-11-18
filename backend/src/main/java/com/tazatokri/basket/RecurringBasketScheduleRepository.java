package com.tazatokri.basket;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RecurringBasketScheduleRepository extends JpaRepository<RecurringBasketSchedule, Long> {

    Optional<RecurringBasketSchedule> findByBasketIdAndCustomerId(Long basketId, Long customerId);

    List<RecurringBasketSchedule> findByCustomerId(Long customerId);
}
