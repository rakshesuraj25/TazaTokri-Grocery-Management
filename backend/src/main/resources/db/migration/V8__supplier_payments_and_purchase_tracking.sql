-- Supplier Management, Purchase Tracking & Append-Only Supplier Payment Ledger

ALTER TABLE suppliers
    ADD COLUMN address VARCHAR(255) NULL,
    ADD COLUMN notes VARCHAR(500) NULL,
    ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);

ALTER TABLE purchases
    ADD COLUMN invoice_number VARCHAR(64) NULL,
    ADD COLUMN idempotency_key VARCHAR(64) NULL,
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    ADD COLUMN cancelled_at DATETIME(6) NULL,
    ADD COLUMN cancelled_by BIGINT NULL,
    ADD COLUMN cancel_reason VARCHAR(255) NULL;

ALTER TABLE purchases
    ADD CONSTRAINT uk_purchases_idempotency_key UNIQUE (idempotency_key),
    ADD INDEX idx_purchases_supplier_date (supplier_id, purchase_date),
    ADD INDEX idx_purchases_invoice (invoice_number);

CREATE TABLE supplier_payments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    supplier_id BIGINT NOT NULL,
    purchase_id BIGINT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    payment_date DATE NOT NULL,
    reference_number VARCHAR(80) NULL,
    idempotency_key VARCHAR(64) NULL,
    notes VARCHAR(500) NULL,
    recorded_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_supplier_payments_idempotency (idempotency_key),
    KEY idx_supplier_payments_supplier_date (supplier_id, payment_date),
    KEY idx_supplier_payments_purchase (purchase_id),
    CONSTRAINT fk_supplier_payments_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
    CONSTRAINT fk_supplier_payments_purchase FOREIGN KEY (purchase_id) REFERENCES purchases (id),
    CONSTRAINT fk_supplier_payments_user FOREIGN KEY (recorded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
