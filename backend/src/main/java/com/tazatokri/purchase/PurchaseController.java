package com.tazatokri.purchase;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/purchases")
public class PurchaseController {

    private final PurchaseService service;

    public PurchaseController(PurchaseService service) {
        this.service = service;
    }

    public record CancelPurchaseRequest(@Size(max = 255) String reason) {}

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseResponse create(@Valid @RequestBody PurchaseRequest req, Authentication auth) {
        return service.create(req, auth.getName());
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    public List<PurchaseResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) PurchaseStatus status,
            @RequestParam(required = false) String q) {
        return service.list(page, supplierId, from, to, status, q);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public PurchaseResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('OWNER')")
    public PurchaseResponse cancel(@PathVariable Long id,
                                   @Valid @RequestBody(required = false) CancelPurchaseRequest req,
                                   Authentication auth) {
        return service.cancel(id, req != null ? req.reason() : null, auth.getName());
    }
}
