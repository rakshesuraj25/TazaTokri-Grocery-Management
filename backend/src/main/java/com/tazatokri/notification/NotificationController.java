package com.tazatokri.notification;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

@RestController
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    public record UpdatePreferenceRequest(
            @NotNull Boolean whatsappOptIn,
            NotificationLanguage preferredLanguage) {}

    @GetMapping("/api/my/notifications/preferences")
    public NotificationService.PreferenceDto getMyPreferences(Authentication auth) {
        return service.getPreference(auth.getName());
    }

    @PutMapping("/api/my/notifications/preferences")
    public NotificationService.PreferenceDto updateMyPreferences(
            @Valid @RequestBody UpdatePreferenceRequest req,
            Authentication auth) {
        return service.updatePreference(
                auth.getName(),
                Boolean.TRUE.equals(req.whatsappOptIn()),
                req.preferredLanguage());
    }

    @GetMapping("/api/my/orders/{orderId}/whatsapp-share")
    public NotificationService.OrderNotificationDto getCustomerOrderShare(
            @PathVariable Long orderId,
            @RequestParam(required = false) NotificationLanguage language,
            Authentication auth) {
        return service.buildCustomerOrderShare(orderId, auth.getName(), language);
    }

    @PostMapping("/api/orders/{orderId}/notifications/{eventType}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF','DELIVERY')")
    public NotificationService.OrderNotificationDto triggerOrderNotification(
            @PathVariable Long orderId,
            @PathVariable NotificationEventType eventType,
            @RequestParam(required = false) NotificationLanguage language) {
        return service.triggerOrderEventNotification(orderId, eventType, language);
    }

    @GetMapping("/api/orders/{orderId}/notifications")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<NotificationService.NotificationLogDto> listOrderNotifications(
            @PathVariable Long orderId) {
        return service.listLogsForOrder(orderId);
    }

    @GetMapping("/api/owner/notifications/status")
    @PreAuthorize("hasRole('OWNER')")
    public NotificationService.ProviderStatusDto providerStatus() {
        return service.getProviderStatus();
    }

    @GetMapping("/api/owner/notifications/logs")
    @PreAuthorize("hasRole('OWNER')")
    public List<NotificationService.NotificationLogDto> listRecentLogs(
            @RequestParam(required = false) NotificationStatus status) {
        return service.listRecentLogs(status);
    }

    @PostMapping("/api/owner/notifications/logs/{logId}/retry")
    @PreAuthorize("hasRole('OWNER')")
    public NotificationService.NotificationLogDto retryNotification(@PathVariable Long logId) {
        return service.retryFailedNotification(logId);
    }
}
