package com.tazatokri.backup;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.ObjectMapper;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.purchase.SupplierRepository;
import com.tazatokri.sales.SaleRepository;
import com.tazatokri.user.UserRepository;

@Service
public class BackupService {

    private static final Pattern UUID_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final DateTimeFormatter FILE_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    public record BackupRecordResponse(
            String backupId,
            BackupType backupType,
            BackupStatus status,
            long fileSizeBytes,
            String sha256Checksum,
            BackupVerificationStatus verificationStatus,
            String verificationMessage,
            LocalDateTime verifiedAt,
            Long createdBy,
            LocalDateTime createdAt,
            String notes) {

        public static BackupRecordResponse from(BackupRecord r) {
            return new BackupRecordResponse(
                    r.getBackupId(),
                    r.getBackupType(),
                    r.getStatus(),
                    r.getFileSizeBytes(),
                    r.getSha256Checksum(),
                    r.getVerificationStatus(),
                    r.getVerificationMessage(),
                    r.getVerifiedAt(),
                    r.getCreatedBy(),
                    r.getCreatedAt(),
                    r.getNotes());
        }
    }

    public record BackupDashboardResponse(
            int totalBackups,
            int verifiedBackups,
            BackupRecordResponse latestBackup,
            List<BackupRecordResponse> history) {}

    public record RestoreReadinessResponse(
            String backupId,
            boolean valid,
            BackupStatus status,
            BackupVerificationStatus verificationStatus,
            String compatibility,
            String warningMessage,
            List<String> prerequisites,
            boolean manualRestoreOnly) {}

    public record DownloadBundle(Resource resource, String downloadFilename) {}

    private final BackupRecordRepository backups;
    private final UserRepository users;
    private final VegetableRepository vegetables;
    private final SupplierRepository suppliers;
    private final PurchaseRepository purchases;
    private final CustomerOrderRepository orders;
    private final SaleRepository sales;
    private final ObjectMapper mapper;
    private final Path baseDir;
    private final Clock clock;
    private final ReentrantLock backupLock = new ReentrantLock();

    @Autowired
    public BackupService(
            BackupRecordRepository backups,
            UserRepository users,
            VegetableRepository vegetables,
            SupplierRepository suppliers,
            PurchaseRepository purchases,
            CustomerOrderRepository orders,
            SaleRepository sales,
            @Value("${app.backup.dir:./data/backups}") String backupDir,
            Clock clock) {
        this.backups = backups;
        this.users = users;
        this.vegetables = vegetables;
        this.suppliers = suppliers;
        this.purchases = purchases;
        this.orders = orders;
        this.sales = sales;
        this.baseDir = Paths.get(backupDir).toAbsolutePath().normalize();
        this.clock = clock;
        this.mapper = new ObjectMapper();
    }

    @Transactional(readOnly = true)
    public BackupDashboardResponse getDashboard() {
        List<BackupRecordResponse> history = backups.findAllByOrderByCreatedAtDescIdDesc().stream()
                .map(BackupRecordResponse::from)
                .toList();
        int verifiedCount = (int) history.stream()
                .filter(b -> b.verificationStatus() == BackupVerificationStatus.VERIFIED)
                .count();
        BackupRecordResponse latest = history.isEmpty() ? null : history.get(0);
        return new BackupDashboardResponse(history.size(), verifiedCount, latest, history);
    }

    @Transactional
    public BackupRecordResponse createManualBackup(String notes, String actorPhone) {
        if (!backupLock.tryLock()) {
            throw new BadRequestException("A backup job is already in progress. Please wait.");
        }
        try {
            Long userId = users.findByPhone(actorPhone)
                    .orElseThrow(() -> new BadRequestException("Unknown user")).getId();

            String backupId = UUID.randomUUID().toString();
            LocalDateTime now = LocalDateTime.now(clock);
            String fileName = "tazatokri-backup-" + now.format(FILE_TS) + "-" + backupId.substring(0, 8) + ".zip";

            BackupRecord record = new BackupRecord();
            record.setBackupId(backupId);
            record.setBackupType(BackupType.MANUAL_SNAPSHOT);
            record.setStatus(BackupStatus.PENDING);
            record.setFileName(fileName);
            record.setVerificationStatus(BackupVerificationStatus.PENDING);
            record.setCreatedBy(userId);
            record.setCreatedAt(now);
            record.setNotes(notes != null && !notes.isBlank() ? notes.trim() : null);
            record = backups.save(record);

            try {
                Path target = resolveSafeFile(fileName);
                Files.createDirectories(baseDir);

                Map<String, Object> snapshot = buildSafeSnapshot(backupId, now);
                byte[] snapshotJson = mapper.writeValueAsBytes(snapshot);
                Map<String, Object> manifest = Map.of(
                        "formatVersion", "1.0",
                        "backupId", backupId,
                        "createdAt", now.toString(),
                        "type", BackupType.MANUAL_SNAPSHOT.name());
                byte[] manifestJson = mapper.writeValueAsBytes(manifest);

                Path tmp = resolveSafeFile(fileName + ".tmp");
                try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(tmp))) {
                    zos.putNextEntry(new ZipEntry("manifest.json"));
                    zos.write(manifestJson);
                    zos.closeEntry();

                    zos.putNextEntry(new ZipEntry("snapshot.json"));
                    zos.write(snapshotJson);
                    zos.closeEntry();
                }
                Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);

                long size = Files.size(target);
                String checksum = sha256Hex(target);

                record.setFileSizeBytes(size);
                record.setSha256Checksum(checksum);

                // Verify immediately before reporting completion
                verifyFileIntegrity(target, checksum);
                record.setStatus(BackupStatus.COMPLETED);
                record.setVerificationStatus(BackupVerificationStatus.VERIFIED);
                record.setVerificationMessage("ZIP structure and SHA-256 checksum verified");
                record.setVerifiedAt(LocalDateTime.now(clock));
                return BackupRecordResponse.from(backups.save(record));
            } catch (Exception ex) {
                record.setStatus(BackupStatus.FAILED);
                record.setVerificationStatus(BackupVerificationStatus.FAILED);
                record.setVerificationMessage("Backup creation or verification failed");
                backups.save(record);
                throw new BadRequestException("Backup creation failed: " + ex.getMessage());
            }
        } finally {
            backupLock.unlock();
        }
    }

    @Transactional
    public BackupRecordResponse verifyBackup(String backupId) {
        BackupRecord record = findValidatedRecord(backupId);
        try {
            Path target = resolveSafeFile(record.getFileName());
            verifyFileIntegrity(target, record.getSha256Checksum());
            record.setVerificationStatus(BackupVerificationStatus.VERIFIED);
            record.setVerificationMessage("ZIP structure and SHA-256 checksum verified");
            record.setVerifiedAt(LocalDateTime.now(clock));
        } catch (Exception ex) {
            record.setVerificationStatus(BackupVerificationStatus.FAILED);
            record.setVerificationMessage(ex.getMessage());
            record.setVerifiedAt(LocalDateTime.now(clock));
        }
        return BackupRecordResponse.from(backups.save(record));
    }

    @Transactional(readOnly = true)
    public DownloadBundle prepareDownload(String backupId) {
        BackupRecord record = findValidatedRecord(backupId);
        if (record.getStatus() != BackupStatus.COMPLETED
                || record.getVerificationStatus() != BackupVerificationStatus.VERIFIED) {
            throw new BadRequestException("Only completed and verified backups can be downloaded");
        }
        Path target = resolveSafeFile(record.getFileName());
        if (!Files.exists(target) || !Files.isRegularFile(target)) {
            throw new ResourceNotFoundException("Backup file is missing");
        }
        try {
            verifyFileIntegrity(target, record.getSha256Checksum());
        } catch (Exception ex) {
            throw new BadRequestException("Backup integrity check failed before download: " + ex.getMessage());
        }
        return new DownloadBundle(new FileSystemResource(target), record.getFileName());
    }

    @Transactional(readOnly = true)
    public RestoreReadinessResponse getRestoreReadiness(String backupId) {
        BackupRecord record = findValidatedRecord(backupId);
        boolean fileOk = false;
        if (record.getFileName() != null && record.getSha256Checksum() != null) {
            try {
                Path target = resolveSafeFile(record.getFileName());
                verifyFileIntegrity(target, record.getSha256Checksum());
                fileOk = true;
            } catch (Exception ignored) {
                fileOk = false;
            }
        }

        boolean valid = record.getStatus() == BackupStatus.COMPLETED
                && record.getVerificationStatus() == BackupVerificationStatus.VERIFIED
                && fileOk;

        return new RestoreReadinessResponse(
                record.getBackupId(),
                valid,
                record.getStatus(),
                record.getVerificationStatus(),
                "TazaTokri Snapshot Format v1.0 (Read-Only JSON/ZIP)",
                "WARNING: Restoring data overwrites current records and may cause data loss for transactions created after this backup.",
                List.of(
                        "Put the store in maintenance/paused mode before any manual restore.",
                        "Verify SHA-256 checksum matches: " + (record.getSha256Checksum() != null ? record.getSha256Checksum() : "N/A"),
                        "Take a fresh pre-restore backup of the current database state.",
                        "Execute restore manually via approved DBA/ops procedure (automated restore is disabled in this phase)."),
                true);
    }

    private BackupRecord findValidatedRecord(String backupId) {
        if (backupId == null || !UUID_PATTERN.matcher(backupId.trim()).matches()) {
            throw new BadRequestException("Invalid backup identifier");
        }
        return backups.findByBackupId(backupId.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Backup not found: " + backupId));
    }

    Path resolveSafeFile(String fileName) {
        if (fileName == null || fileName.isBlank()
                || fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")) {
            throw new BadRequestException("Invalid backup file reference");
        }
        Path resolved = baseDir.resolve(fileName).normalize();
        if (!resolved.startsWith(baseDir) || resolved.equals(baseDir)) {
            throw new BadRequestException("Invalid backup storage path");
        }
        return resolved;
    }

    private void verifyFileIntegrity(Path target, String expectedSha256) throws IOException {
        if (!Files.exists(target) || !Files.isRegularFile(target)) {
            throw new IOException("Backup file does not exist");
        }
        long size = Files.size(target);
        if (size <= 0) {
            throw new IOException("Backup file is empty");
        }
        boolean hasManifest = false;
        boolean hasSnapshot = false;
        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(Files.newInputStream(target)))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if ("manifest.json".equals(entry.getName())) hasManifest = true;
                if ("snapshot.json".equals(entry.getName())) hasSnapshot = true;
                zis.closeEntry();
            }
        }
        if (!hasManifest || !hasSnapshot) {
            throw new IOException("Invalid backup ZIP structure");
        }
        if (expectedSha256 == null || expectedSha256.isBlank()) {
            throw new IOException("Missing expected checksum");
        }
        String actual = sha256Hex(target);
        if (!expectedSha256.equalsIgnoreCase(actual)) {
            throw new IOException("SHA-256 checksum mismatch");
        }
    }

    private static String sha256Hex(Path file) throws IOException {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            try (InputStream in = Files.newInputStream(file)) {
                byte[] buf = new byte[8192];
                int read;
                while ((read = in.read(buf)) != -1) {
                    md.update(buf, 0, read);
                }
            }
            return HexFormat.of().formatHex(md.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private Map<String, Object> buildSafeSnapshot(String backupId, LocalDateTime createdAt) {
        // Read-only safe business snapshot: NEVER exports users/passwords/tokens/secrets
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("backupId", backupId);
        root.put("createdAt", createdAt.toString());
        root.put("vegetables", vegetables.findAll().stream()
                .map(v -> Map.of(
                        "id", v.getId(),
                        "nameEn", v.getNameEn(),
                        "baseUnit", v.getBaseUnit() != null ? v.getBaseUnit().name() : "KG",
                        "active", v.isActive(),
                        "available", v.isAvailable()))
                .toList());
        root.put("suppliers", suppliers.findAll().stream()
                .map(s -> Map.of(
                        "id", s.getId(),
                        "name", s.getName(),
                        "type", s.getType().name(),
                        "active", s.isActive()))
                .toList());
        root.put("purchasesCount", purchases.count());
        root.put("ordersCount", orders.count());
        root.put("salesCount", sales.count());
        return root;
    }
}
