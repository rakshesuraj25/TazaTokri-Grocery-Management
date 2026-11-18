package com.tazatokri.notification;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, Long> {
    Optional<NotificationLog> findByOrderIdAndEventTypeAndChannel(
            Long orderId,
            NotificationEventType eventType,
            NotificationChannel channel);

    List<NotificationLog> findByOrderIdOrderByCreatedAtDescIdDesc(Long orderId);
}
