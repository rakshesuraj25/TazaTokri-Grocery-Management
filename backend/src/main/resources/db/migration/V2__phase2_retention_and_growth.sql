-- TazaTokri Phase 2 Flyway Migration:
-- 1. Customer WhatsApp notification preferences & notification logs
-- 2. Vegetable Combo Packs & Combo Items
-- 3. Customer Saved Grocery Baskets & Recurring Basket Schedules

CREATE TABLE `notification_preferences` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `whatsapp_opt_in` bit(1) NOT NULL DEFAULT b'0',
  `consent_timestamp` datetime(6) DEFAULT NULL,
  `preferred_language` enum('EN','MR','HI') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EN',
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_prefs_user` (`user_id`),
  CONSTRAINT `fk_notification_prefs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notification_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `customer_id` bigint NOT NULL,
  `event_type` enum('ORDER_PLACED','ORDER_CONFIRMED','ORDER_PACKED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('WHATSAPP_MANUAL','WHATSAPP_CLOUD_API') COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` enum('EN','MR','HI') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PREPARED','SENT','SKIPPED_NO_CONSENT','SKIPPED_DISABLED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_message_id` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_detail` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_order_event_channel` (`order_id`,`event_type`,`channel`),
  KEY `idx_notification_order` (`order_id`),
  CONSTRAINT `fk_notification_logs_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_notification_logs_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `combos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name_en` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_mr` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_hi` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description_en` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description_mr` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description_hi` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `selling_price` decimal(10,2) NOT NULL,
  `active` bit(1) NOT NULL DEFAULT b'1',
  `available` bit(1) NOT NULL DEFAULT b'1',
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_combos_name_en` (`name_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `combo_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `combo_id` bigint NOT NULL,
  `vegetable_id` bigint NOT NULL,
  `unit_label` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_in_base_unit` decimal(10,3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_combo_veg` (`combo_id`,`vegetable_id`),
  KEY `fk_combo_items_vegetable` (`vegetable_id`),
  CONSTRAINT `fk_combo_items_combo` FOREIGN KEY (`combo_id`) REFERENCES `combos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_combo_items_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `saved_baskets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_saved_baskets_customer` (`customer_id`),
  CONSTRAINT `fk_saved_baskets_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE `recurring_basket_schedules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `basket_id` bigint NOT NULL,
  `customer_id` bigint NOT NULL,
  `frequency` enum('DAILY','WEEKLY','CUSTOM_WEEKDAY','BIWEEKLY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `preferred_day_of_week` int DEFAULT NULL,
  `next_reminder_date` date NOT NULL,
  `status` enum('ACTIVE','PAUSED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recurring_schedule_basket` (`basket_id`),
  KEY `idx_recurring_customer_status` (`customer_id`,`status`),
  CONSTRAINT `fk_recurring_schedule_basket` FOREIGN KEY (`basket_id`) REFERENCES `saved_baskets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recurring_schedule_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
