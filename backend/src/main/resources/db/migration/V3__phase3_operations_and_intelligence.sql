-- TazaTokri Phase 3 Flyway Migration:
-- Audit log for AI-assisted purchase invoice and Quick Sale list draft extractions.
-- Never stores API keys or raw uploaded documents.

CREATE TABLE `ai_extraction_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `extraction_type` enum('PURCHASE_INVOICE','QUICK_SALE_LIST') COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_type` enum('IMAGE','PDF','TEXT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_used` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('DRAFT_GENERATED','CONFIRMED','DISABLED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `extracted_items_count` int NOT NULL DEFAULT 0,
  `unmatched_items_count` int NOT NULL DEFAULT 0,
  `reference_id` bigint DEFAULT NULL,
  `error_detail` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ai_logs_user_created` (`user_id`,`created_at`),
  CONSTRAINT `fk_ai_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
