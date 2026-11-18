package com.tazatokri.order;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/orders")
@PreAuthorize("hasAnyRole('OWNER','STAFF')")
public class StaffOrderController {

    private final OrderFlowService service;
    public StaffOrderController(OrderFlowService service) { this.service = service; }

    @GetMapping
    public List<OrderResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) OrderStatus status) {
        return service.listForStaff(date, status);
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable Long id) { return service.getForStaff(id); }

    @PostMapping("/{id}/confirm")
    public OrderResponse confirm(@PathVariable Long id) { return service.confirm(id); }

    @PostMapping("/{id}/pack")
    public OrderResponse pack(@PathVariable Long id, @Valid @RequestBody PackRequest req,
                              Authentication auth) {
        return service.pack(id, req, auth.getName());
    }

    @PostMapping("/{id}/cancel")
    public OrderResponse cancel(@PathVariable Long id, @Valid @RequestBody CancelRequest req,
                                Authentication auth) {
        boolean owner = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_OWNER"));
        return service.cancelByStaff(id, req.reason(), auth.getName(), owner);
    }
}