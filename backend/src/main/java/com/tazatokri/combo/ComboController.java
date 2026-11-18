package com.tazatokri.combo;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
public class ComboController {

    private final ComboService service;

    public ComboController(ComboService service) {
        this.service = service;
    }

    @GetMapping("/api/public/combos")
    public List<ComboService.ComboDto> listPublic() {
        return service.listPublic();
    }

    @GetMapping("/api/staff/combos")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<ComboService.ComboDto> listStaff() {
        return service.listStaff();
    }

    @PostMapping("/api/staff/combos")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public ComboService.ComboDto create(@Valid @RequestBody ComboService.ComboUpsertRequest req) {
        return service.create(req);
    }

    @PutMapping("/api/staff/combos/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public ComboService.ComboDto update(
            @PathVariable Long id,
            @Valid @RequestBody ComboService.ComboUpsertRequest req) {
        return service.update(id, req);
    }

    @PatchMapping("/api/staff/combos/{id}/available")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public ComboService.ComboDto setAvailable(
            @PathVariable Long id,
            @RequestParam boolean value) {
        return service.setAvailable(id, value);
    }

    @PatchMapping("/api/staff/combos/{id}/active")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public ComboService.ComboDto setActive(
            @PathVariable Long id,
            @RequestParam boolean value) {
        return service.setActive(id, value);
    }

    @PostMapping("/api/staff/combos/seed-defaults")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<ComboService.ComboDto> seedDefaults() {
        return service.seedDefaults();
    }
}
