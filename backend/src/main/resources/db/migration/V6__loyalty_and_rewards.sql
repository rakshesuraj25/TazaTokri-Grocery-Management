-- Phase 6: Customer Loyalty & Rewards System

CREATE TABLE loyalty_settings (
    id BIGINT NOT NULL PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    points_per_100_inr DECIMAL(8,2) NOT NULL DEFAULT 5.00,
    rupees_per_point DECIMAL(8,4) NOT NULL DEFAULT 1.0000,
    min_redeem_points INT NOT NULL DEFAULT 50,
    max_redeem_points_per_order INT NOT NULL DEFAULT 200,
    expiry_days INT NULL,
    updated_by BIGINT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_loyalty_settings_user FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO loyalty_settings (
    id, enabled, points_per_100_inr, rupees_per_point,
    min_redeem_points, max_redeem_points_per_order, expiry_days, updated_at
) VALUES (
    1, FALSE, 5.00, 1.0000, 50, 200, NULL, CURRENT_TIMESTAMP
);

CREATE TABLE loyalty_transactions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    order_id BIGINT NULL,
    type VARCHAR(24) NOT NULL,
    points INT NOT NULL,
    rupee_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    idempotency_key VARCHAR(80) NOT NULL,
    description VARCHAR(255) NULL,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_loyalty_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_loyalty_tx_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_loyalty_tx_order FOREIGN KEY (order_id) REFERENCES orders(id),
    INDEX idx_loyalty_customer_created (customer_id, created_at, id),
    INDEX idx_loyalty_order (order_id),
    INDEX idx_loyalty_type_created (type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders
    ADD COLUMN loyalty_points_redeemed INT NOT NULL DEFAULT 0,
    ADD COLUMN loyalty_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
