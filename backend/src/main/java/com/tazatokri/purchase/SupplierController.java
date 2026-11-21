package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierService service;

    public SupplierController(SupplierService service) {
        this.service = service;
    }

    public record SupplierRequest(
            @NotBlank @Size(max = 100) String name,
            @NotNull SupplierType type,
            @Pattern(regexp = "^([6-9][0-9]{9})?$") String phone,
            @Size(max = 255) String address,
            @Size(max = 500) String notes,
            Boolean active) {}

    public record SupplierResponse(
            Long id,
            String name,
            SupplierType type,
            String phone,
            String address,
            String notes,
            boolean active,
            LocalDateTime createdAt) {

        public static SupplierResponse from(Supplier s) {
            return new SupplierResponse(
                    s.getId(), s.getName(), s.getType(), s.getPhone(),
                    s.getAddress(), s.getNotes(), s.isActive(), s.getCreatedAt());
        }
    }

    public record StatusRequest(@NotNull Boolean active) {}

    public record RecordSupplierPaymentRequest(
            Long purchaseId,
            @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount,
            @NotNull SupplierPaymentMethod paymentMethod,
            @NotNull @PastOrPresent LocalDate paymentDate,
            @Size(max = 80) String referenceNumber,
            @Size(max = 64) String idempotencyKey,
            @Size(max = 500) String notes) {}

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<SupplierResponse> list(@RequestParam(defaultValue = "false") boolean activeOnly) {
        return service.listBasic(activeOnly).stream()
                .map(SupplierResponse::from)
                .toList();
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasRole('OWNER')")
    public SupplierService.SupplierDashboardResponse dashboard(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean active) {
        return service.getDashboard(q, active);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public SupplierService.SupplierDetailResponse detail(@PathVariable Long id) {
        return service.getDetail(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    @ResponseStatus(HttpStatus.CREATED)
    public SupplierResponse create(@Valid @RequestBody SupplierRequest req) {
        Supplier s = service.create(new SupplierService.SupplierCreateUpdateRequest(
                req.name(), req.type(), req.phone(), req.address(), req.notes(), req.active()));
        return SupplierResponse.from(s);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public SupplierResponse update(@PathVariable Long id, @Valid @RequestBody SupplierRequest req) {
        Supplier s = service.update(id, new SupplierService.SupplierCreateUpdateRequest(
                req.name(), req.type(), req.phone(), req.address(), req.notes(), req.active()));
        return SupplierResponse.from(s);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('OWNER')")
    public SupplierResponse updateStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest req) {
        return SupplierResponse.from(service.updateStatus(id, req.active()));
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("hasRole('OWNER')")
    @ResponseStatus(HttpStatus.CREATED)
    public SupplierService.SupplierPaymentResponse recordPayment(
            @PathVariable Long id,
            @Valid @RequestBody RecordSupplierPaymentRequest req,
            Authentication auth) {
        return service.recordPayment(id, new SupplierService.RecordPaymentRequest(
                req.purchaseId(),
                req.amount(),
                req.paymentMethod(),
                req.paymentDate(),
                req.referenceNumber(),
                req.idempotencyKey(),
                req.notes()), auth.getName());
    }

    @GetMapping("/{id}/payments")
    @PreAuthorize("hasRole('OWNER')")
    public List<SupplierService.SupplierPaymentResponse> listPayments(@PathVariable Long id) {
        return service.listPayments(id);
    }
}
