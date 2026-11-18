package com.tazatokri.ai;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "ai_extraction_logs")
@Getter
@Setter
@NoArgsConstructor
public class AiExtractionLog {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "workflow_type", nullable = false, length = 40)
	private String workflowType;

	@Column(name = "actor_user_id")
	private Long actorUserId;

	@Column(name = "actor_phone", length = 20)
	private String actorPhone;

	@Column(name = "source_type", nullable = false, length = 30)
	private String sourceType;

	@Column(name = "file_name", length = 255)
	private String fileName;

	@Column(name = "mime_type", length = 80)
	private String mimeType;

	@Column(name = "file_size_bytes")
	private Long fileSizeBytes;

	@Column(name = "model_used", length = 80)
	private String modelUsed;

	@Column(name = "status", nullable = false, length = 30)
	private String status;

	@Column(name = "extracted_lines_count", nullable = false)
	private int extractedLinesCount;

	@Column(name = "matched_lines_count", nullable = false)
	private int matchedLinesCount;

	@Column(name = "warning_message", length = 500)
	private String warningMessage;

	@Column(name = "created_at", nullable = false, updatable = false)
	private LocalDateTime createdAt = LocalDateTime.now();
}
