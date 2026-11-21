package com.tazatokri.backup;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "backup_records",
       uniqueConstraints = @UniqueConstraint(name = "uk_backup_records_backup_id", columnNames = "backup_id"),
       indexes = @Index(name = "idx_backup_records_created", columnList = "created_at"))
@Getter
@Setter
public class BackupRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "backup_id", nullable = false, length = 36, updatable = false)
    private String backupId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BackupType backupType = BackupType.MANUAL_SNAPSHOT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BackupStatus status = BackupStatus.PENDING;

    @Column(length = 120)
    private String fileName;

    @Column(nullable = false)
    private long fileSizeBytes = 0L;

    @Column(name = "sha256_checksum", length = 64)
    private String sha256Checksum;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BackupVerificationStatus verificationStatus = BackupVerificationStatus.PENDING;

    @Column(length = 255)
    private String verificationMessage;

    @Column
    private LocalDateTime verifiedAt;

    @Column(nullable = false, updatable = false)
    private Long createdBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(length = 255)
    private String notes;
}
