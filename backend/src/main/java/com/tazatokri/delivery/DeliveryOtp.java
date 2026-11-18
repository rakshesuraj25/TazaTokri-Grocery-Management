package com.tazatokri.delivery;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "delivery_otps",
       indexes = {
           @Index(name = "idx_delivery_otps_order_status", columnList = "order_id, status"),
           @Index(name = "idx_delivery_otps_attempt", columnList = "delivery_attempt_id")
       })
@Getter
@Setter
@NoArgsConstructor
public class DeliveryOtp {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "order_id", nullable = false)
	private Long orderId;

	@Column(name = "delivery_attempt_id", nullable = false)
	private Long deliveryAttemptId;

	@Column(name = "otp_hash", nullable = false, length = 255)
	private String otpHash;

	@Column(name = "expires_at", nullable = false)
	private LocalDateTime expiresAt;

	@Column(name = "failed_attempts", nullable = false)
	private int failedAttempts = 0;

	@Column(name = "max_attempts", nullable = false)
	private int maxAttempts = 5;

	@Column(name = "status", nullable = false, length = 20)
	private String status = "ACTIVE";

	@Column(name = "delivery_channel", nullable = false, length = 30)
	private String deliveryChannel;

	@Column(name = "issued_by", nullable = false)
	private Long issuedBy;

	@Column(name = "verified_by")
	private Long verifiedBy;

	@Column(name = "verified_at")
	private LocalDateTime verifiedAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private LocalDateTime createdAt = LocalDateTime.now();
}
