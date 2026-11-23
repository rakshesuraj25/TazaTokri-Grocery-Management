package com.tazatokri.payment;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

@RestController
@RequestMapping("/api/customer/orders/{orderId}/payment")
@PreAuthorize("hasRole('CUSTOMER')")
public class CustomerPaymentController {

    public record PaymentFailureRequest(
            @NotBlank String razorpayOrderId,
            String razorpayPaymentId,
            String reason) {}

    private final OnlinePaymentService service;
    public CustomerPaymentController(OnlinePaymentService service) { this.service = service; }

    @PostMapping
    public OnlinePaymentService.PaymentInit start(@PathVariable Long orderId, Authentication auth) {
        return service.start(orderId, auth.getName());
    }

    @PostMapping("/verify")
    public OnlinePaymentService.VerifyResult verify(@PathVariable Long orderId,
                                                    @Valid @RequestBody VerifyRequest req,
                                                    Authentication auth) {
        return service.verify(orderId, req, auth.getName());
    }

    @PostMapping("/fail")
    public OnlinePaymentService.VerifyResult fail(@PathVariable Long orderId,
                                                  @Valid @RequestBody PaymentFailureRequest req,
                                                  Authentication auth) {
        return service.markFailed(orderId, req.razorpayOrderId(), req.razorpayPaymentId(),
                req.reason(), auth.getName());
    }
}