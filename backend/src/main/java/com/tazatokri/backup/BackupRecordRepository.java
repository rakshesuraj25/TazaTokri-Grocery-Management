package com.tazatokri.backup;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BackupRecordRepository extends JpaRepository<BackupRecord, Long> {

    List<BackupRecord> findAllByOrderByCreatedAtDescIdDesc();

    Optional<BackupRecord> findByBackupId(String backupId);
}
