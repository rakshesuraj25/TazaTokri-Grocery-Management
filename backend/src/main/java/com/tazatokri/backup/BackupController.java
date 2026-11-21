package com.tazatokri.backup;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/backups")
@PreAuthorize("hasRole('OWNER')")
public class BackupController {

    private final BackupService service;

    public BackupController(BackupService service) {
        this.service = service;
    }

    public record CreateBackupRequest(@Size(max = 255) String notes) {}

    @GetMapping
    public BackupService.BackupDashboardResponse dashboard() {
        return service.getDashboard();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BackupService.BackupRecordResponse create(
            @Valid @RequestBody(required = false) CreateBackupRequest req,
            Authentication auth) {
        return service.createManualBackup(req != null ? req.notes() : null, auth.getName());
    }

    @PostMapping("/{backupId}/verify")
    public BackupService.BackupRecordResponse verify(@PathVariable String backupId) {
        return service.verifyBackup(backupId);
    }

    @GetMapping("/{backupId}/readiness")
    public BackupService.RestoreReadinessResponse readiness(@PathVariable String backupId) {
        return service.getRestoreReadiness(backupId);
    }

    @GetMapping("/{backupId}/download")
    public ResponseEntity<Resource> download(@PathVariable String backupId) {
        BackupService.DownloadBundle bundle = service.prepareDownload(backupId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(bundle.downloadFilename()).build().toString())
                .body(bundle.resource());
    }
}
