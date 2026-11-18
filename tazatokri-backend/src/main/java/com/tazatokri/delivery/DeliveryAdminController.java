package com.tazatokri.delivery;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasAnyRole('OWNER','STAFF')")
public class DeliveryAdminController {

    private final DeliveryService service;
    public DeliveryAdminController(DeliveryService service) { this.service = service; }

    @GetMapping("/delivery/people")
    public List<DeliveryPersonResponse> people() { return service.people(); }

    @PostMapping("/orders/{id}/assign")
    public AttemptResponse assign(@PathVariable Long id, @Valid @RequestBody AssignRequest req,
                                  Authentication auth) {
        return service.assign(id, req.deliveryUserId(), auth.getName());
    }

    @GetMapping("/orders/{id}/deliveries")
    public List<AttemptResponse> history(@PathVariable Long id) { return service.history(id); }
}