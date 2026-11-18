-- TazaTokri Flyway baseline migration
-- Generated from the existing MySQL schema.
-- Table creation order is arranged so referenced tables exist before foreign keys are added.

CREATE TABLE `categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `name` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_phone` (`phone`),
  UNIQUE KEY `UK6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `suppliers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('FARMER','OTHER','WHOLESALE_MARKET') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_suppliers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sales` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `client_ref` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` bigint NOT NULL,
  `payment_method` enum('CASH','UPI') COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_client_ref` (`client_ref`),
  KEY `idx_sales_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cancel_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_ref` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `customer_id` bigint NOT NULL,
  `delivery_address` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_date` date NOT NULL,
  `delivery_fee` decimal(10,2) NOT NULL,
  `delivery_pincode` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estimated_total` decimal(12,2) NOT NULL,
  `final_total` decimal(12,2) DEFAULT NULL,
  `payment_method` enum('COD','ONLINE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('CANCELLED','CONFIRMED','DELIVERED','OUT_FOR_DELIVERY','PACKED','PENDING_PAYMENT','PLACED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_client_ref` (`client_ref`),
  KEY `idx_orders_customer` (`customer_id`,`id`),
  KEY `idx_orders_status_date` (`status`,`delivery_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vegetables` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `available` bit(1) NOT NULL,
  `base_unit` enum('BUNCH','KG','PIECE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_en` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_hi` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_mr` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `category_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vegetables_name_en` (`name_en`),
  KEY `fk_vegetables_category` (`category_id`),
  CONSTRAINT `fk_vegetables_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `addresses` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `default_address` bit(1) NOT NULL,
  `label` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `landmark` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `line1` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `line2` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pincode` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_addresses_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_roles` (
  `user_id` bigint NOT NULL,
  `role` enum('CUSTOMER','DELIVERY','OWNER','STAFF') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`user_id`,`role`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `purchases` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` bigint NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_date` date NOT NULL,
  `total_cost` decimal(12,2) NOT NULL,
  `transport_cost` decimal(10,2) NOT NULL,
  `supplier_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_purchases_date` (`purchase_date`),
  KEY `fk_purchases_supplier` (`supplier_id`),
  CONSTRAINT `fk_purchases_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `delivery_attempts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assigned_at` datetime(6) NOT NULL,
  `assigned_by` bigint NOT NULL,
  `delivery_user_id` bigint NOT NULL,
  `failure_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `finished_at` datetime(6) DEFAULT NULL,
  `order_id` bigint NOT NULL,
  `started_at` datetime(6) DEFAULT NULL,
  `status` enum('ASSIGNED','DELIVERED','FAILED','OUT_FOR_DELIVERY','UNASSIGNED') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_delivery_order` (`order_id`),
  KEY `idx_delivery_user_status` (`delivery_user_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `amount` decimal(12,2) NOT NULL,
  `collected_by` bigint DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `kind` enum('COLLECTION','REFUND') COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` enum('CASH','RAZORPAY','UPI_QR') COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` bigint NOT NULL,
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `settled_at` datetime(6) DEFAULT NULL,
  `settled_by` bigint DEFAULT NULL,
  `status` enum('FAILED','PENDING','SUCCESS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_payment_id` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payments_provider_payment` (`provider_payment_id`),
  KEY `idx_payments_order` (`order_id`),
  KEY `idx_payments_cash` (`collected_by`,`settled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  CONSTRAINT `fk_order_items_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE `stock_movements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` bigint NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `reference_id` bigint DEFAULT NULL,
  `reference_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('ADJUSTMENT','ONLINE_CANCEL_RETURN','ONLINE_SALE','PURCHASE','SHOP_SALE','WASTAGE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `vegetable_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stock_veg_created` (`vegetable_id`,`created_at`),
  CONSTRAINT `fk_stock_movements_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vegetable_prices` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` bigint NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_per_unit` decimal(10,2) NOT NULL,
  `source` enum('MANUAL','SUGGESTED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `vegetable_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_price_veg` (`vegetable_id`,`id`),
  CONSTRAINT `fk_vegetable_prices_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vegetable_units` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `default_option` bit(1) NOT NULL,
  `label` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_in_base_unit` decimal(10,3) NOT NULL,
  `vegetable_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vegetable_units_label` (`vegetable_id`,`label`),
  CONSTRAINT `fk_vegetable_units_vegetable` FOREIGN KEY (`vegetable_id`) REFERENCES `vegetables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
