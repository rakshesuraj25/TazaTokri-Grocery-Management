package com.tazatokri.delivery;

import java.time.LocalDateTime;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "delivery_attempts",
       indexes = {
           @Index(name = "idx_delivery_order", columnList = "order_id"),
           @Index(name = "idx_delivery_user_status", columnList = "delivery_user_id, status")
       })
@Getter @Setter
public class DeliveryAttempt {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "delivery_user_id", nullable = false)
    private Long deliveryUserId;

    @Column(name = "assigned_by", nullable = false, updatable = false)
    private Long assignedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DeliveryStatus status = DeliveryStatus.ASSIGNED;

    @Column(nullable = false, updatable = false)
    private LocalDateTime assignedAt = LocalDateTime.now();

    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;

    @Column(length = 255)
    private String failureReason;

    @Column(name = "otp_verified", nullable = false)
    private boolean otpVerified = false;

    @Column(name = "otp_verified_at")
    private LocalDateTime otpVerifiedAt;

    @Column(name = "otp_verified_by")
    private Long otpVerifiedBy;

    @Column(name = "otp_verification_method", length = 30)
    private String otpVerificationMethod;

    @Column(name = "otp_override_reason", length = 255)
    private String otpOverrideReason;

    @Column(name = "delivery_note", length = 255)
    private String deliveryNote;
}
