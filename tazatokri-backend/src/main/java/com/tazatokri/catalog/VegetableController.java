package com.tazatokri.catalog;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/vegetables")
public class VegetableController {

    private final VegetableService service;
    private final CatalogSeedService seedService;

    public VegetableController(VegetableService service, CatalogSeedService seedService) {
        this.service = service;
        this.seedService = seedService;
    }

    @PostMapping("/seed-catalog")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CatalogSeedService.SeedSummary seedCatalog(
            @RequestParam(name = "withSamplePrices", defaultValue = "false") boolean withSamplePrices) {
        return seedService.seedDefaultCatalog(withSamplePrices);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public VegetableResponse create(@Valid @RequestBody VegetableRequest req) {
        return service.create(req);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<VegetableResponse> list() { return service.listActive(); }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public VegetableResponse get(@PathVariable Long id) { return service.get(id); }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public VegetableResponse update(@PathVariable Long id,
                                    @Valid @RequestBody VegetableUpdateRequest req) {
        return service.update(id, req);
    }

    @PatchMapping("/{id}/availability")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public VegetableResponse setAvailable(@PathVariable Long id, @RequestParam boolean value) {
        return service.setAvailable(id, value);
    }

    @PatchMapping("/{id}/active")
    @PreAuthorize("hasRole('OWNER')")
    public VegetableResponse setActive(@PathVariable Long id, @RequestParam boolean value) {
        return service.setActive(id, value);
    }
}