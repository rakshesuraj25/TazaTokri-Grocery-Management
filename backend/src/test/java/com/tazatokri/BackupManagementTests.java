package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.backup.BackupController;
import com.tazatokri.backup.BackupRecord;
import com.tazatokri.backup.BackupRecordRepository;
import com.tazatokri.backup.BackupService;
import com.tazatokri.backup.BackupStatus;
import com.tazatokri.backup.BackupVerificationStatus;
import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.purchase.SupplierRepository;
import com.tazatokri.sales.SaleRepository;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class BackupManagementTests {

    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-11-21T10:00:00Z"), ZoneId.of("Asia/Kolkata"));

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    private BackupService createService(Path tempDir, Map<String, BackupRecord> store) {
        AtomicLong seq = new AtomicLong(1);
        BackupRecordRepository backupRepo = proxy(BackupRecordRepository.class, (p, m, a) -> switch (m.getName()) {
            case "save" -> {
                BackupRecord r = (BackupRecord) a[0];
                if (r.getId() == null) r.setId(seq.getAndIncrement());
                store.put(r.getBackupId(), r);
                yield r;
            }
            case "findByBackupId" -> Optional.ofNullable(store.get((String) a[0]));
            case "findAllByOrderByCreatedAtDescIdDesc" -> store.values().stream()
                    .sorted((x, y) -> Long.compare(y.getId(), x.getId()))
                    .toList();
            default -> throw new UnsupportedOperationException("BackupRecordRepository." + m.getName());
        });

        User owner = new User();
        owner.setId(1L);
        owner.setPhone("9876543210");
        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) ->
                "findByPhone".equals(m.getName()) && "9876543210".equals(a[0])
                        ? Optional.of(owner) : Optional.empty());

        Vegetable v = new Vegetable();
        v.setId(1L);
        v.setNameEn("Tomato");
        v.setBaseUnit(UnitType.KG);
        VegetableRepository vegRepo = proxy(VegetableRepository.class, (p, m, a) -> List.of(v));
        SupplierRepository supRepo = proxy(SupplierRepository.class, (p, m, a) -> List.of());
        PurchaseRepository purRepo = proxy(PurchaseRepository.class, (p, m, a) -> 0L);
        CustomerOrderRepository ordRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> 0L);
        SaleRepository saleRepo = proxy(SaleRepository.class, (p, m, a) -> 0L);

        return new BackupService(
                backupRepo, userRepo, vegRepo, supRepo, purRepo, ordRepo, saleRepo,
                tempDir.toString(), FIXED_CLOCK);
    }

    @Test
    void createsVerifiesDownloadsAndChecksRestoreReadinessSafely(@TempDir Path tempDir) throws Exception {
        Map<String, BackupRecord> store = new ConcurrentHashMap<>();
        BackupService service = createService(tempDir, store);

        BackupService.BackupRecordResponse created =
                service.createManualBackup("Before price update", "9876543210");

        assertEquals(BackupStatus.COMPLETED, created.status());
        assertEquals(BackupVerificationStatus.VERIFIED, created.verificationStatus());
        assertTrue(created.fileSizeBytes() > 0);
        assertNotNull(created.sha256Checksum());
        assertEquals(64, created.sha256Checksum().length());

        // Dashboard reflects backup
        BackupService.BackupDashboardResponse dash = service.getDashboard();
        assertEquals(1, dash.totalBackups());
        assertEquals(1, dash.verifiedBackups());

        // Download works for verified backup
        BackupService.DownloadBundle bundle = service.prepareDownload(created.backupId());
        assertTrue(bundle.resource().exists());
        assertTrue(bundle.downloadFilename().endsWith(".zip"));

        // Restore readiness check is advisory and manual-only
        BackupService.RestoreReadinessResponse readiness = service.getRestoreReadiness(created.backupId());
        assertTrue(readiness.valid());
        assertTrue(readiness.manualRestoreOnly());
        assertTrue(readiness.warningMessage().contains("WARNING"));
        assertFalse(readiness.prerequisites().isEmpty());

        // Tamper with the ZIP file -> verifyBackup marks FAILED and download is blocked
        BackupRecord raw = store.get(created.backupId());
        Files.writeString(tempDir.resolve(raw.getFileName()), "corrupted");

        BackupService.BackupRecordResponse reVerified = service.verifyBackup(created.backupId());
        assertEquals(BackupVerificationStatus.FAILED, reVerified.verificationStatus());
        assertThrows(BadRequestException.class, () -> service.prepareDownload(created.backupId()));
        assertFalse(service.getRestoreReadiness(created.backupId()).valid());
    }

    @Test
    void rejectsInvalidIdsPathTraversalAndChecksOwnerAuth(@TempDir Path tempDir) {
        Map<String, BackupRecord> store = new ConcurrentHashMap<>();
        BackupService service = createService(tempDir, store);

        // Invalid UUID / path traversal attempt via backupId
        assertThrows(BadRequestException.class, () -> service.verifyBackup("../../.env"));
        assertThrows(BadRequestException.class, () -> service.prepareDownload("not-a-uuid"));
        assertThrows(ResourceNotFoundException.class,
                () -> service.getRestoreReadiness("11111111-1111-1111-1111-111111111111"));

        PreAuthorize auth = BackupController.class.getAnnotation(PreAuthorize.class);
        assertNotNull(auth);
        assertEquals("hasRole('OWNER')", auth.value());
    }
}
