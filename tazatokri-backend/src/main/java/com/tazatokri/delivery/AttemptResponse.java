package com.tazatokri.delivery;

import java.time.LocalDateTime;

public record AttemptResponse(Long id, Long orderId, Long deliveryUserId, Long assignedBy,
        DeliveryStatus status, LocalDateTime assignedAt, LocalDateTime startedAt,
        LocalDateTime finishedAt, String failureReason) {

    public static AttemptResponse from(DeliveryAttempt a) {
        return new AttemptResponse(a.getId(), a.getOrderId(), a.getDeliveryUserId(),
                a.getAssignedBy(), a.getStatus(), a.getAssignedAt(), a.getStartedAt(),
                a.getFinishedAt(), a.getFailureReason());
    }
}