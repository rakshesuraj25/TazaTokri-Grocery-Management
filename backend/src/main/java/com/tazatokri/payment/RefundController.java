package com.tazatokri.payment;

import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments/refunds")
@PreAuthorize("hasRole('OWNER')")
public class RefundController {

    private final RefundService service;
    public RefundController(RefundService service) { this.service = service; }

    @PostMapping("/process")
    public Map<String, Integer> process() {
        return Map.of("refunded", service.processPending());
    }
}