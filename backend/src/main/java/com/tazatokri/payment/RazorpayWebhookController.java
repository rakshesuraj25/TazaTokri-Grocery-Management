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
            JSONObject pay = extractPaymentEntity(json);
            if (pay != null) {
                service.handleCaptured(pay.optString("order_id"), pay.optString("id"), pay.optLong("amount"));
            }
        } else if (event.equals("payment.failed")) {
            JSONObject pay = extractPaymentEntity(json);
            if (pay != null) {
                service.handleFailed(pay.optString("order_id"), pay.optString("id"), pay.optString("error_description"));
            }
        }
        return ResponseEntity.ok().build();     // unknown events: acknowledge so Razorpay stops retrying
    }

    private static JSONObject extractPaymentEntity(JSONObject root) {
        JSONObject payload = root.optJSONObject("payload");
        if (payload == null) return null;
        JSONObject payment = payload.optJSONObject("payment");
        if (payment == null) return null;
        return payment.optJSONObject("entity");
    }
}