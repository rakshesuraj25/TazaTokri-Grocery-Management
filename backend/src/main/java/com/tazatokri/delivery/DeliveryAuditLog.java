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
@Table(name = "delivery_audit_logs",
       indexes = {
           @Index(name = "idx_delivery_audit_order", columnList = "order_id, created_at"),
           @Index(name = "idx_delivery_audit_attempt", columnList = "delivery_attempt_id")
       })
@Getter
@Setter
@NoArgsConstructor
public class DeliveryAuditLog {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "order_id", nullable = false)
	private Long orderId;

	@Column(name = "delivery_attempt_id")
	private Long deliveryAttemptId;

	@Column(name = "action_type", nullable = false, length = 40)
	private String actionType;

	@Column(name = "from_status", length = 30)
	private String fromStatus;

	@Column(name = "to_status", length = 30)
	private String toStatus;

	@Column(name = "actor_user_id", nullable = false)
	private Long actorUserId;

	@Column(name = "actor_role", length = 30)
	private String actorRole;

	@Column(name = "note", length = 255)
	private String note;

	@Column(name = "created_at", nullable = false, updatable = false)
	private LocalDateTime createdAt = LocalDateTime.now();
}
