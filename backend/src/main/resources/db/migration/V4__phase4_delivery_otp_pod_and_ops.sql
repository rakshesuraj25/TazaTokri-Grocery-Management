-- Phase 4: Delivery Management, OTP Verification, Proof of Delivery, and Operational Audit Logs

ALTER TABLE addresses
    ADD COLUMN delivery_instructions VARCHAR(255) NULL,
    ADD COLUMN latitude DECIMAL(10, 7) NULL,
    ADD COLUMN longitude DECIMAL(10, 7) NULL;

ALTER TABLE orders
    ADD COLUMN delivery_instructions VARCHAR(255) NULL;

ALTER TABLE delivery_attempts
    MODIFY COLUMN status VARCHAR(30) NOT NULL,
    ADD COLUMN otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN otp_verified_at DATETIME(6) NULL,
    ADD COLUMN otp_verified_by BIGINT NULL,
    ADD COLUMN otp_verification_method VARCHAR(30) NULL,
    ADD COLUMN otp_override_reason VARCHAR(255) NULL,
    ADD COLUMN delivery_note VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS delivery_otps (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    delivery_attempt_id BIGINT NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    failed_attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    status VARCHAR(20) NOT NULL,
    delivery_channel VARCHAR(30) NOT NULL,
    issued_by BIGINT NOT NULL,
    verified_by BIGINT NULL,
    verified_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_delivery_otps_order_status (order_id, status),
    INDEX idx_delivery_otps_attempt (delivery_attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_evidences (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    delivery_attempt_id BIGINT NOT NULL,
    storage_provider VARCHAR(30) NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NULL,
    mime_type VARCHAR(60) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    uploaded_by BIGINT NOT NULL,
    verification_method VARCHAR(30) NULL,
    delivery_note VARCHAR(255) NULL,
    uploaded_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_delivery_evidence_key (storage_key),
    INDEX idx_delivery_evidence_order (order_id),
    INDEX idx_delivery_evidence_attempt (delivery_attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    delivery_attempt_id BIGINT NULL,
    action_type VARCHAR(40) NOT NULL,
    from_status VARCHAR(30) NULL,
    to_status VARCHAR(30) NULL,
    actor_user_id BIGINT NOT NULL,
    actor_role VARCHAR(30) NULL,
    note VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_delivery_audit_order (order_id, created_at),
    INDEX idx_delivery_audit_attempt (delivery_attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
