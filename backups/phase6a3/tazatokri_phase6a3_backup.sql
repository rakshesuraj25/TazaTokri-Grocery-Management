-- =================================================================
-- TAZATOKRI PHASE 6A.3 PHYSICAL DATABASE BACKUP
-- Source Database: tazatokri_phase6a3_test
-- Engine: MySQL 8.4.13 InnoDB
-- =================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Structure for table `addresses`
DROP TABLE IF EXISTS `addresses`;
CREATE TABLE `addresses` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `default_address` bit(1) NOT NULL,
  `label` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `landmark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `line1` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `line2` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pincode` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  `delivery_instructions` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_addresses_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `ai_extraction_logs`
DROP TABLE IF EXISTS `ai_extraction_logs`;
CREATE TABLE `ai_extraction_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `extraction_type` enum('PURCHASE_INVOICE','QUICK_SALE_LIST') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_type` enum('IMAGE','PDF','TEXT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_used` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('DRAFT_GENERATED','CONFIRMED','DISABLED','FAILED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `extracted_items_count` int NOT NULL DEFAULT '0',
  `unmatched_items_count` int NOT NULL DEFAULT '0',
  `reference_id` bigint DEFAULT NULL,
  `error_detail` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ai_logs_user_created` (`user_id`,`created_at`),
  CONSTRAINT `fk_ai_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `categories`
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `name` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `combo_items`
DROP TABLE IF EXISTS `combo_items`;
CREATE TABLE `combo_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `combo_id` bigint NOT NULL,
  `vegetable_id` bigint NOT NULL,
  `unit_label` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_in_base_unit` decimal(10,3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_combo_veg` (`combo_id`,`vegetable_id`),
  KEY `fk_combo_items_vegetable` (`vegetable_id`),
  CONSTRAINT `fk_combo_items_combo` FOREIGN KEY (`combo_id`) REFERENCES `combos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_combo_items_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `combos`
DROP TABLE IF EXISTS `combos`;
CREATE TABLE `combos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name_en` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_mr` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_hi` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description_en` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description_mr` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description_hi` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `selling_price` decimal(10,2) NOT NULL,
  `active` bit(1) NOT NULL DEFAULT b'1',
  `available` bit(1) NOT NULL DEFAULT b'1',
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_combos_name_en` (`name_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `delivery_attempts`
DROP TABLE IF EXISTS `delivery_attempts`;
CREATE TABLE `delivery_attempts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assigned_at` datetime(6) NOT NULL,
  `assigned_by` bigint NOT NULL,
  `delivery_user_id` bigint NOT NULL,
  `failure_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `finished_at` datetime(6) DEFAULT NULL,
  `order_id` bigint NOT NULL,
  `started_at` datetime(6) DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_verified` tinyint(1) NOT NULL DEFAULT '0',
  `otp_verified_at` datetime(6) DEFAULT NULL,
  `otp_verified_by` bigint DEFAULT NULL,
  `otp_verification_method` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp_override_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_delivery_order` (`order_id`),
  KEY `idx_delivery_user_status` (`delivery_user_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `delivery_audit_logs`
DROP TABLE IF EXISTS `delivery_audit_logs`;
CREATE TABLE `delivery_audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `delivery_attempt_id` bigint DEFAULT NULL,
  `action_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_user_id` bigint NOT NULL,
  `actor_role` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_delivery_audit_order` (`order_id`,`created_at`),
  KEY `idx_delivery_audit_attempt` (`delivery_attempt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `delivery_evidences`
DROP TABLE IF EXISTS `delivery_evidences`;
CREATE TABLE `delivery_evidences` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `delivery_attempt_id` bigint NOT NULL,
  `storage_provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `storage_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_filename` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mime_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size_bytes` bigint NOT NULL,
  `sha256_checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_by` bigint NOT NULL,
  `verification_method` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_delivery_evidence_key` (`storage_key`),
  KEY `idx_delivery_evidence_order` (`order_id`),
  KEY `idx_delivery_evidence_attempt` (`delivery_attempt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `delivery_otps`
DROP TABLE IF EXISTS `delivery_otps`;
CREATE TABLE `delivery_otps` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `delivery_attempt_id` bigint NOT NULL,
  `otp_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `failed_attempts` int NOT NULL DEFAULT '0',
  `max_attempts` int NOT NULL DEFAULT '5',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_channel` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issued_by` bigint NOT NULL,
  `verified_by` bigint DEFAULT NULL,
  `verified_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_delivery_otps_order_status` (`order_id`,`status`),
  KEY `idx_delivery_otps_attempt` (`delivery_attempt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `flyway_schema_history`
DROP TABLE IF EXISTS `flyway_schema_history`;
CREATE TABLE `flyway_schema_history` (
  `installed_rank` int NOT NULL,
  `version` varchar(50) DEFAULT NULL,
  `description` varchar(200) NOT NULL,
  `type` varchar(20) NOT NULL,
  `script` varchar(1000) NOT NULL,
  `checksum` int DEFAULT NULL,
  `installed_by` varchar(100) NOT NULL,
  `installed_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `execution_time` int NOT NULL,
  `success` tinyint(1) NOT NULL,
  PRIMARY KEY (`installed_rank`),
  KEY `flyway_schema_history_s_idx` (`success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `flyway_schema_history` (4 rows)
INSERT INTO `flyway_schema_history` VALUES 
(1, '1', 'baseline', 'SQL', 'V1__baseline.sql', 1305888077, 'tazatokri_test', '2026-11-20 11:55:36.0', 781, true),
(2, '2', 'phase2 retention and growth', 'SQL', 'V2__phase2_retention_and_growth.sql', 1390094672, 'tazatokri_test', '2026-11-20 11:55:36.0', 308, true),
(3, '3', 'phase3 operations and intelligence', 'SQL', 'V3__phase3_operations_and_intelligence.sql', -290965319, 'tazatokri_test', '2026-11-20 11:55:36.0', 48, true),
(4, '4', 'phase4 delivery otp pod and ops', 'SQL', 'V4__phase4_delivery_otp_pod_and_ops.sql', 762747875, 'tazatokri_test', '2026-11-20 11:55:37.0', 371, true);

-- Structure for table `notification_logs`
DROP TABLE IF EXISTS `notification_logs`;
CREATE TABLE `notification_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `customer_id` bigint NOT NULL,
  `event_type` enum('ORDER_PLACED','ORDER_CONFIRMED','ORDER_PACKED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('WHATSAPP_MANUAL','WHATSAPP_CLOUD_API') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` enum('EN','MR','HI') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PREPARED','SENT','SKIPPED_NO_CONSENT','SKIPPED_DISABLED','FAILED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_message_id` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_detail` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_order_event_channel` (`order_id`,`event_type`,`channel`),
  KEY `idx_notification_order` (`order_id`),
  KEY `fk_notification_logs_customer` (`customer_id`),
  CONSTRAINT `fk_notification_logs_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_notification_logs_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `notification_preferences`
DROP TABLE IF EXISTS `notification_preferences`;
CREATE TABLE `notification_preferences` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `whatsapp_opt_in` bit(1) NOT NULL DEFAULT b'0',
  `consent_timestamp` datetime(6) DEFAULT NULL,
  `preferred_language` enum('EN','MR','HI') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EN',
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_prefs_user` (`user_id`),
  CONSTRAINT `fk_notification_prefs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `order_items`
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `actual_quantity` decimal(12,3) DEFAULT NULL,
  `estimated_line_total` decimal(12,2) NOT NULL,
  `final_line_total` decimal(12,2) DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `order_id` bigint NOT NULL,
  `vegetable_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_veg` (`order_id`,`vegetable_id`),
  KEY `fk_order_items_vegetable` (`vegetable_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_order_items_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `orders`
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cancel_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_ref` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `customer_id` bigint NOT NULL,
  `delivery_address` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_date` date NOT NULL,
  `delivery_fee` decimal(10,2) NOT NULL,
  `delivery_pincode` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `estimated_total` decimal(12,2) NOT NULL,
  `final_total` decimal(12,2) DEFAULT NULL,
  `payment_method` enum('COD','ONLINE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('CANCELLED','CONFIRMED','DELIVERED','OUT_FOR_DELIVERY','PACKED','PENDING_PAYMENT','PLACED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `delivery_instructions` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_client_ref` (`client_ref`),
  KEY `idx_orders_customer` (`customer_id`,`id`),
  KEY `idx_orders_status_date` (`status`,`delivery_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `payments`
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `amount` decimal(12,2) NOT NULL,
  `collected_by` bigint DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `kind` enum('COLLECTION','REFUND') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` enum('CASH','RAZORPAY','UPI_QR') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` bigint NOT NULL,
  `reference` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `settled_at` datetime(6) DEFAULT NULL,
  `settled_by` bigint DEFAULT NULL,
  `status` enum('FAILED','PENDING','SUCCESS') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_payment_id` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payments_provider_payment` (`provider_payment_id`),
  KEY `idx_payments_order` (`order_id`),
  KEY `idx_payments_cash` (`collected_by`,`settled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `purchase_items`
DROP TABLE IF EXISTS `purchase_items`;
CREATE TABLE `purchase_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `landed_cost_per_unit` decimal(12,4) NOT NULL,
  `line_cost` decimal(12,2) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `rate_per_unit` decimal(10,2) NOT NULL,
  `transport_share` decimal(10,2) NOT NULL,
  `purchase_id` bigint NOT NULL,
  `vegetable_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_purchase_veg` (`purchase_id`,`vegetable_id`),
  KEY `fk_purchase_items_vegetable` (`vegetable_id`),
  CONSTRAINT `fk_purchase_items_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  CONSTRAINT `fk_purchase_items_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `purchases`
DROP TABLE IF EXISTS `purchases`;
CREATE TABLE `purchases` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` bigint NOT NULL,
  `note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_date` date NOT NULL,
  `total_cost` decimal(12,2) NOT NULL,
  `transport_cost` decimal(10,2) NOT NULL,
  `supplier_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_purchases_date` (`purchase_date`),
  KEY `fk_purchases_supplier` (`supplier_id`),
  CONSTRAINT `fk_purchases_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `recurring_basket_schedules`
DROP TABLE IF EXISTS `recurring_basket_schedules`;
CREATE TABLE `recurring_basket_schedules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `basket_id` bigint NOT NULL,
  `customer_id` bigint NOT NULL,
  `frequency` enum('DAILY','WEEKLY','CUSTOM_WEEKDAY','BIWEEKLY') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `preferred_day_of_week` int DEFAULT NULL,
  `next_reminder_date` date NOT NULL,
  `status` enum('ACTIVE','PAUSED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recurring_schedule_basket` (`basket_id`),
  KEY `idx_recurring_customer_status` (`customer_id`,`status`),
  CONSTRAINT `fk_recurring_schedule_basket` FOREIGN KEY (`basket_id`) REFERENCES `saved_baskets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recurring_schedule_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `sale_items`
DROP TABLE IF EXISTS `sale_items`;
CREATE TABLE `sale_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `line_total` decimal(12,2) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `sale_id` bigint NOT NULL,
  `vegetable_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_veg` (`sale_id`,`vegetable_id`),
  KEY `fk_sale_items_vegetable` (`vegetable_id`),
  CONSTRAINT `fk_sale_items_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`),
  CONSTRAINT `fk_sale_items_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `sales`
DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `client_ref` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` bigint NOT NULL,
  `payment_method` enum('CASH','UPI') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_client_ref` (`client_ref`),
  KEY `idx_sales_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `saved_basket_items`
DROP TABLE IF EXISTS `saved_basket_items`;
CREATE TABLE `saved_basket_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `basket_id` bigint NOT NULL,
  `vegetable_id` bigint NOT NULL,
  `unit_id` bigint NOT NULL,
  `count` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_basket_veg_unit` (`basket_id`,`vegetable_id`,`unit_id`),
  KEY `fk_basket_items_vegetable` (`vegetable_id`),
  CONSTRAINT `fk_basket_items_basket` FOREIGN KEY (`basket_id`) REFERENCES `saved_baskets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_basket_items_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `saved_baskets`
DROP TABLE IF EXISTS `saved_baskets`;
CREATE TABLE `saved_baskets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_saved_baskets_customer` (`customer_id`),
  CONSTRAINT `fk_saved_baskets_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `stock_movements`
DROP TABLE IF EXISTS `stock_movements`;
CREATE TABLE `stock_movements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` bigint NOT NULL,
  `note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `reference_id` bigint DEFAULT NULL,
  `reference_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('ADJUSTMENT','ONLINE_CANCEL_RETURN','ONLINE_SALE','PURCHASE','SHOP_SALE','WASTAGE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `vegetable_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stock_veg_created` (`vegetable_id`,`created_at`),
  CONSTRAINT `fk_stock_movements_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `suppliers`
DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('FARMER','OTHER','WHOLESALE_MARKET') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_suppliers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `user_roles`
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
  `user_id` bigint NOT NULL,
  `role` enum('CUSTOMER','DELIVERY','OWNER','STAFF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`user_id`,`role`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `users`
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_phone` (`phone`),
  UNIQUE KEY `UK6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `vegetable_prices`
DROP TABLE IF EXISTS `vegetable_prices`;
CREATE TABLE `vegetable_prices` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` bigint NOT NULL,
  `note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_per_unit` decimal(10,2) NOT NULL,
  `source` enum('MANUAL','SUGGESTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `vegetable_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_price_veg` (`vegetable_id`,`id`),
  CONSTRAINT `fk_vegetable_prices_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `vegetable_units`
DROP TABLE IF EXISTS `vegetable_units`;
CREATE TABLE `vegetable_units` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `default_option` bit(1) NOT NULL,
  `label` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_in_base_unit` decimal(10,3) NOT NULL,
  `vegetable_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vegetable_units_label` (`vegetable_id`,`label`),
  CONSTRAINT `fk_vegetable_units_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure for table `vegetables`
DROP TABLE IF EXISTS `vegetables`;
CREATE TABLE `vegetables` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `available` bit(1) NOT NULL,
  `base_unit` enum('BUNCH','KG','PIECE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `image_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_en` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_hi` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_mr` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `category_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vegetables_name_en` (`name_en`),
  KEY `fk_vegetables_category` (`category_id`),
  CONSTRAINT `fk_vegetables_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
