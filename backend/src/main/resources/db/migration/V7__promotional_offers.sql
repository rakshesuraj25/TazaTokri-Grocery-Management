-- Phase 7: Customer Retention & Promotional Offers

CREATE TABLE promo_offers (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(32) NOT NULL,
    description VARCHAR(255) NULL,
    discount_type VARCHAR(16) NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    max_discount_amount DECIMAL(10,2) NULL,
    starts_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    max_total_uses INT NULL,
    max_uses_per_customer INT NOT NULL DEFAULT 1,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_promo_offers_code UNIQUE (code),
    CONSTRAINT fk_promo_offers_user FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_promo_offers_active_dates (enabled, starts_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promo_redemptions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    offer_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_promo_redemptions_order UNIQUE (order_id),
    CONSTRAINT fk_promo_redemptions_offer FOREIGN KEY (offer_id) REFERENCES promo_offers(id),
    CONSTRAINT fk_promo_redemptions_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_promo_redemptions_order FOREIGN KEY (order_id) REFERENCES orders(id),
    INDEX idx_promo_redemptions_offer_customer (offer_id, customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders
    ADD COLUMN promo_code VARCHAR(32) NULL,
    ADD COLUMN promo_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
