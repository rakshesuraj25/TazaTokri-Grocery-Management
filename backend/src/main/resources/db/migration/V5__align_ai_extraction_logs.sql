-- Align ai_extraction_logs table with AiExtractionLog JPA entity
ALTER TABLE `ai_extraction_logs`
  MODIFY COLUMN `user_id` bigint NULL,
  MODIFY COLUMN `extraction_type` varchar(40) COLLATE utf8mb4_unicode_ci NULL,
  MODIFY COLUMN `input_type` varchar(30) COLLATE utf8mb4_unicode_ci NULL,
  MODIFY COLUMN `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  ADD COLUMN `workflow_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN `actor_user_id` bigint NULL,
  ADD COLUMN `actor_phone` varchar(20) COLLATE utf8mb4_unicode_ci NULL,
  ADD COLUMN `source_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NULL,
  ADD COLUMN `mime_type` varchar(80) COLLATE utf8mb4_unicode_ci NULL,
  ADD COLUMN `file_size_bytes` bigint NULL,
  ADD COLUMN `extracted_lines_count` int NOT NULL DEFAULT 0,
  ADD COLUMN `matched_lines_count` int NOT NULL DEFAULT 0,
  ADD COLUMN `warning_message` varchar(500) COLLATE utf8mb4_unicode_ci NULL;
