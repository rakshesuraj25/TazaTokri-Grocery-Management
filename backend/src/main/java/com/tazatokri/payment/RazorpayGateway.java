package com.tazatokri.payment;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Refund;
import com.tazatokri.common.PaymentGatewayException;

@Component
public class RazorpayGateway {

    private final String keyId;
    private final String keySecret;
    private final String webhookSecret;
    private final RazorpayClient client;      // null when keys are not configured

    public RazorpayGateway(@Value("${app.razorpay.key-id}") String keyId,
                           @Value("${app.razorpay.key-secret}") String keySecret,
                           @Value("${app.razorpay.webhook-secret}") String webhookSecret)
            throws RazorpayException {
        this.keyId = keyId;
        this.keySecret = keySecret;
        this.webhookSecret = webhookSecret;
        this.client = (keyId.isBlank() || keySecret.isBlank()) ? null : new RazorpayClient(keyId, keySecret);
    }

    public boolean isConfigured() { return client != null; }

    public String keyId() { return keyId; }

    public static long toPaise(BigDecimal rupees) {
        return rupees.movePointRight(2).longValueExact();
    }

    public String createOrder(long amountPaise, String receipt) {
        try {
            JSONObject req = new JSONObject();
            req.put("amount", amountPaise);
            req.put("currency", "INR");
            req.put("receipt", receipt);
            Order order = client.orders.create(req);
            return order.get("id");
        } catch (RazorpayException e) {
            throw new PaymentGatewayException("Razorpay order creation failed", e);
        }
    }

    public String refund(String razorpayPaymentId, long amountPaise, String receipt) {
        try {
            JSONObject req = new JSONObject();
            req.put("amount", amountPaise);
            req.put("receipt", receipt);
            Refund refund = client.payments.refund(razorpayPaymentId, req);
            return refund.get("id");
        } catch (RazorpayException e) {
            throw new PaymentGatewayException("Razorpay refund failed", e);
        }
    }

    public boolean verifyPaymentSignature(String razorpayOrderId, String razorpayPaymentId, String signature) {
        if (keySecret.isBlank() || signature == null) return false;
        String expected = hmac((razorpayOrderId + "|" + razorpayPaymentId).getBytes(StandardCharsets.UTF_8), keySecret);
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }

    public boolean verifyWebhookSignature(byte[] rawBody, String signature) {
        if (webhookSecret.isBlank() || signature == null) return false;
        String expected = hmac(rawBody, webhookSecret);
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }

    private String hmac(byte[] data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
    
    public record CapturedPayment(String id, long amountPaise) {}

    /** Asks Razorpay whether any payment on this Razorpay order was captured. */
    public Optional<CapturedPayment> findCapturedPayment(String razorpayOrderId) {
        try {
            List<com.razorpay.Payment> list = client.orders.fetchPayments(razorpayOrderId);
            for (com.razorpay.Payment p : list) {
                JSONObject j = p.toJson();
                if ("captured".equals(j.optString("status"))) {
                    return Optional.of(new CapturedPayment(j.getString("id"), j.getLong("amount")));
                }
            }
            return Optional.empty();
        } catch (RazorpayException e) {
            throw new PaymentGatewayException("Razorpay payment lookup failed", e);
        }
    }
}