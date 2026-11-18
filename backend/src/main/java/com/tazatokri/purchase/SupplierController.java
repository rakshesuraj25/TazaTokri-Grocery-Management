package com.tazatokri.purchase;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.catalog.VegetableService;
import com.tazatokri.common.DuplicateResourceException;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierRepository repo;
    public SupplierController(SupplierRepository repo) { this.repo = repo; }

    public record SupplierRequest(@NotBlank @Size(max = 100) String name,
                                  @NotNull SupplierType type,
                                  @Pattern(regexp = "^[6-9][0-9]{9}$") String phone) {}
    public record SupplierResponse(Long id, String name, SupplierType type, String phone, boolean active) {}

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SupplierResponse create(@Valid @RequestBody SupplierRequest req) {
        String name = VegetableService.normalize(req.name());
        if (repo.existsByNameIgnoreCase(name)) {
            throw new DuplicateResourceException("Supplier already exists: " + name);
        }
        Supplier s = new Supplier();
        s.setName(name);
        s.setType(req.type());
        s.setPhone(req.phone());
        s = repo.save(s);
        return new SupplierResponse(s.getId(), s.getName(), s.getType(), s.getPhone(), s.isActive());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<SupplierResponse> list() {
        return repo.findAll().stream()
                .map(s -> new SupplierResponse(s.getId(), s.getName(), s.getType(), s.getPhone(), s.isActive()))
                .toList();
    }
}