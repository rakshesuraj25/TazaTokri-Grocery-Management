package com.tazatokri.delivery;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "delivery_evidences",
       uniqueConstraints = @UniqueConstraint(name = "uk_delivery_evidence_key", columnNames = "storage_key"),
       indexes = {
           @Index(name = "idx_delivery_evidence_order", columnList = "order_id"),
           @Index(name = "idx_delivery_evidence_attempt", columnList = "delivery_attempt_id")
       })
@Getter
@Setter
@NoArgsConstructor
public class DeliveryEvidence {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "order_id", nullable = false)
	private Long orderId;

	@Column(name = "delivery_attempt_id", nullable = false)
	private Long deliveryAttemptId;

	@Column(name = "storage_provider", nullable = false, length = 30)
	private String storageProvider;

	@Column(name = "storage_key", nullable = false, length = 255)
	private String storageKey;

	@Column(name = "original_filename", length = 255)
	private String originalFilename;

	@Column(name = "mime_type", nullable = false, length = 60)
	private String mimeType;

	@Column(name = "file_size_bytes", nullable = false)
	private long fileSizeBytes;

	@Column(name = "sha256_checksum", nullable = false, length = 64)
	private String sha256Checksum;

	@Column(name = "uploaded_by", nullable = false)
	private Long uploadedBy;

	@Column(name = "verification_method", length = 30)
	private String verificationMethod;

	@Column(name = "delivery_note", length = 255)
	private String deliveryNote;

	@Column(name = "uploaded_at", nullable = false, updatable = false)
	private LocalDateTime uploadedAt = LocalDateTime.now();
}
