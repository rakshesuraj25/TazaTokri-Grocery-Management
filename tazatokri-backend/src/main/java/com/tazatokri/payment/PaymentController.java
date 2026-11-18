package com.tazatokri.payment;

import java.math.BigDecimal;
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
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService service;
    public PaymentController(PaymentService service) { this.service = service; }

    public record SettleRequest(
            @NotNull Long deliveryUserId,
            @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal receivedAmount) {}

    @GetMapping("/orders/{orderId}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<PaymentResponse> forOrder(@PathVariable Long orderId) {
        return service.forOrder(orderId);
    }

    @GetMapping("/cash-pending")
    @PreAuthorize("hasRole('OWNER')")
    public List<PendingCashResponse> pendingCash() { return service.pendingCash(); }

    @PostMapping("/settle")
    @PreAuthorize("hasRole('OWNER')")
    public SettlementResponse settle(@Valid @RequestBody SettleRequest req, Authentication auth) {
        return service.settle(req.deliveryUserId(), req.receivedAmount(), auth.getName());
    }
}