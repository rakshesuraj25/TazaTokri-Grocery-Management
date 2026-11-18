package com.tazatokri.delivery;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.order.OrderStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class DeliveryDtos {

	private DeliveryDtos() {
	}

	public record OtpIssueResponse(
			Long orderId,
			Long deliveryAttemptId,
			LocalDateTime expiresAt,
			int maxAttempts,
			String deliveryChannel,
			String maskedCustomerPhone,
			String message) {
	}

	public record OtpVerifyRequest(
			@NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "OTP must be 6 digits") String otp) {
	}

	public record OtpVerifyResponse(
			boolean verified,
			LocalDateTime verifiedAt,
			String verificationMethod,
			int remainingAttempts,
			String message) {
	}

	public record ManualOtpOverrideRequest(
			@NotBlank @Size(min = 10, max = 255, message = "Override reason must be at least 10 characters") String reason) {
	}

	public record ReturnToStoreRequest(
			@Size(max = 255) String note) {
	}

	public record DeliveryEvidenceResponse(
			Long id,
			Long orderId,
			Long deliveryAttemptId,
			String mimeType,
			long fileSizeBytes,
			Long uploadedBy,
			String verificationMethod,
			String deliveryNote,
			LocalDateTime uploadedAt,
			String downloadPath) {

		public static DeliveryEvidenceResponse from(DeliveryEvidence e) {
			return new DeliveryEvidenceResponse(
					e.getId(),
					e.getOrderId(),
					e.getDeliveryAttemptId(),
					e.getMimeType(),
					e.getFileSizeBytes(),
					e.getUploadedBy(),
					e.getVerificationMethod(),
					e.getDeliveryNote(),
					e.getUploadedAt(),
					"/api/orders/" + e.getOrderId() + "/delivery-evidence/" + e.getId() + "/photo");
		}
	}

	public record DeliveryAuditLogResponse(
			Long id,
			Long orderId,
			Long deliveryAttemptId,
			String actionType,
			String fromStatus,
			String toStatus,
			Long actorUserId,
			String actorRole,
			String note,
			LocalDateTime createdAt) {

		public static DeliveryAuditLogResponse from(DeliveryAuditLog l) {
			return new DeliveryAuditLogResponse(
					l.getId(),
					l.getOrderId(),
					l.getDeliveryAttemptId(),
					l.getActionType(),
					l.getFromStatus(),
					l.getToStatus(),
					l.getActorUserId(),
					l.getActorRole(),
					l.getNote(),
					l.getCreatedAt());
		}
	}

	public record StaffDeliveryOrderItem(
			Long orderId,
			OrderStatus orderStatus,
			String deliveryStage,
			DeliveryStatus attemptStatus,
			Long attemptId,
			LocalDate deliveryDate,
			String customerName,
			String customerPhone,
			String deliveryAddress,
			String deliveryPincode,
			String locality,
			String deliveryInstructions,
			BigDecimal orderAmount,
			OrderPaymentMethod paymentMethod,
			String paymentStatus,
			BigDecimal amountToCollect,
			Long assignedDeliveryUserId,
			String assignedDeliveryUserName,
			String assignedDeliveryUserPhone,
			boolean otpVerified,
			String otpVerificationMethod,
			boolean hasProofPhoto,
			Long latestProofEvidenceId,
			String failureReason) {
	}

	public record GroupBucket(
			String groupKey,
			String label,
			int orderCount) {
	}

	public record StaffDeliveryBoardResponse(
			LocalDate date,
			int readyForDeliveryCount,
			int assignedCount,
			int outForDeliveryCount,
			int deliveredCount,
			int failedCount,
			int cancelledCount,
			List<GroupBucket> byPincode,
			List<GroupBucket> byLocality,
			List<GroupBucket> byAssignee,
			List<StaffDeliveryOrderItem> orders) {
	}
}
