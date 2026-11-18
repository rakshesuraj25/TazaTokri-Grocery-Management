package com.tazatokri.payment;

import java.nio.charset.StandardCharsets;

import org.json.JSONObject;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments/razorpay")
public class RazorpayWebhookController {

    private final RazorpayGateway gateway;
    private final OnlinePaymentService service;

    public RazorpayWebhookController(RazorpayGateway gateway, OnlinePaymentService service) {
        this.gateway = gateway;
        this.service = service;
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(@RequestBody byte[] body,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {

        if (!gateway.verifyWebhookSignature(body, signature)) {
            return ResponseEntity.badRequest().build();
        }
        JSONObject json = new JSONObject(new String(body, StandardCharsets.UTF_8));
        String event = json.optString("event");

        if (event.equals("payment.captured") || event.equals("order.paid")) {
            JSONObject pay = json.getJSONObject("payload").getJSONObject("payment").getJSONObject("entity");
            service.handleCaptured(pay.getString("order_id"), pay.getString("id"), pay.getLong("amount"));
        }
        return ResponseEntity.ok().build();     // unknown events: acknowledge so Razorpay stops retrying
    }
}