-- Backup Management & Restore Readiness Metadata (Append-Only History)

CREATE TABLE backup_records (
    id BIGINT NOT NULL AUTO_INCREMENT,
    backup_id VARCHAR(36) NOT NULL,
    backup_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL,
    file_name VARCHAR(120) NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256_checksum VARCHAR(64) NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    verification_message VARCHAR(255) NULL,
    verified_at DATETIME(6) NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    notes VARCHAR(255) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_backup_records_backup_id (backup_id),
    KEY idx_backup_records_created (created_at),
    CONSTRAINT fk_backup_records_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
