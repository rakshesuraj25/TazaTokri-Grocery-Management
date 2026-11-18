package com.tazatokri.delivery;

import java.time.LocalDateTime;

public record AttemptResponse(
		Long id,
		Long orderId,
		Long deliveryUserId,
		Long assignedBy,
		DeliveryStatus status,
		LocalDateTime assignedAt,
		LocalDateTime startedAt,
		LocalDateTime finishedAt,
		String failureReason,
		boolean otpVerified,
		LocalDateTime otpVerifiedAt,
		String otpVerificationMethod,
		String otpOverrideReason,
		String deliveryNote) {

	public AttemptResponse(Long id, Long orderId, Long deliveryUserId, Long assignedBy,
			DeliveryStatus status, LocalDateTime assignedAt, LocalDateTime startedAt,
			LocalDateTime finishedAt, String failureReason) {
		this(id, orderId, deliveryUserId, assignedBy, status, assignedAt, startedAt,
				finishedAt, failureReason, false, null, null, null, null);
	}

	public static AttemptResponse from(DeliveryAttempt a) {
		return new AttemptResponse(
				a.getId(),
				a.getOrderId(),
				a.getDeliveryUserId(),
				a.getAssignedBy(),
				a.getStatus(),
				a.getAssignedAt(),
				a.getStartedAt(),
				a.getFinishedAt(),
				a.getFailureReason(),
				a.isOtpVerified(),
				a.getOtpVerifiedAt(),
				a.getOtpVerificationMethod(),
				a.getOtpOverrideReason(),
				a.getDeliveryNote());
	}
}
