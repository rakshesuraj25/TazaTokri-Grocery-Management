package com.tazatokri.notification;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Optional Stage 2 Official WhatsApp Business Cloud API Provider.
 * Safely disabled by default when WHATSAPP_ENABLED=false or credentials are absent.
 * Never logs access tokens or sensitive customer message bodies.
 */
@Component
public class WhatsAppCloudApiProvider {

    private final boolean enabled;
    private final String phoneNumberId;
    private final String accessToken;
    private final String businessAccountId;
    private final String apiVersion;
    private final String webhookVerifyToken;

    public WhatsAppCloudApiProvider(
            @Value("${app.whatsapp.enabled:false}") boolean enabled,
            @Value("${app.whatsapp.phone-number-id:}") String phoneNumberId,
            @Value("${app.whatsapp.access-token:}") String accessToken,
            @Value("${app.whatsapp.business-account-id:}") String businessAccountId,
            @Value("${app.whatsapp.api-version:v21.0}") String apiVersion,
            @Value("${app.whatsapp.webhook-verify-token:}") String webhookVerifyToken) {
        this.enabled = enabled;
        this.phoneNumberId = phoneNumberId == null ? "" : phoneNumberId.trim();
        this.accessToken = accessToken == null ? "" : accessToken.trim();
        this.businessAccountId = businessAccountId == null ? "" : businessAccountId.trim();
        this.apiVersion = (apiVersion == null || apiVersion.isBlank()) ? "v21.0" : apiVersion.trim();
        this.webhookVerifyToken = webhookVerifyToken == null ? "" : webhookVerifyToken.trim();
    }

    public record CloudSendResult(
            NotificationStatus status,
            String providerMessageId,
            String errorDetail) {

        public static CloudSendResult disabled() {
            return new CloudSendResult(
                    NotificationStatus.SKIPPED_DISABLED,
                    null,
                    "WhatsApp Cloud API is disabled or unconfigured; using manual wa.me sharing");
        }
    }

    public boolean isConfiguredAndEnabled() {
        return enabled && !phoneNumberId.isEmpty() && !accessToken.isEmpty();
    }

    public String getBusinessAccountId() {
        return businessAccountId;
    }

    public boolean verifyWebhookToken(String candidate) {
        return !webhookVerifyToken.isEmpty() && webhookVerifyToken.equals(candidate);
    }

    public CloudSendResult sendTemplateOrText(String recipientPhone, String messageText) {
        if (!isConfiguredAndEnabled()) {
            return CloudSendResult.disabled();
        }
        String normalizedPhone = OrderMessageTemplates.normalizeIndianPhone(recipientPhone);
        if (normalizedPhone.isEmpty()) {
            return new CloudSendResult(NotificationStatus.FAILED, null, "Invalid recipient phone");
        }

        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(8))
                    .build();

            String endpoint = "https://graph.facebook.com/" + apiVersion + "/" + phoneNumberId + "/messages";
            String escapedBody = messageText
                    .replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n");
            String payload = "{\"messaging_product\":\"whatsapp\",\"to\":\"" + normalizedPhone
                    + "\",\"type\":\"text\",\"text\":{\"body\":\"" + escapedBody + "\"}}";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status >= 200 && status < 300) {
                return new CloudSendResult(NotificationStatus.SENT, "wamid-http-" + status, null);
            }
            if (status == 429) {
                return new CloudSendResult(NotificationStatus.FAILED, null, "Cloud API rate limit (HTTP 429)");
            }
            return new CloudSendResult(NotificationStatus.FAILED, null, "Cloud API HTTP " + status);
        } catch (Exception ex) {
            return new CloudSendResult(
                    NotificationStatus.FAILED,
                    null,
                    "Cloud API network error: " + ex.getClass().getSimpleName());
        }
    }
}
