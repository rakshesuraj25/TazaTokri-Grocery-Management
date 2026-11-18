package com.tazatokri.notification;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class NotificationService {

    private final NotificationPreferenceRepository preferences;
    private final NotificationLogRepository logs;
    private final CustomerOrderRepository orders;
    private final UserRepository users;
    private final WhatsAppCloudApiProvider cloudProvider;
    private final String shopSupportPhone;

    public NotificationService(
            NotificationPreferenceRepository preferences,
            NotificationLogRepository logs,
            CustomerOrderRepository orders,
            UserRepository users,
            WhatsAppCloudApiProvider cloudProvider,
            @Value("${app.whatsapp.shop-support-phone:9999999999}") String shopSupportPhone) {
        this.preferences = preferences;
        this.logs = logs;
        this.orders = orders;
        this.users = users;
        this.cloudProvider = cloudProvider;
        this.shopSupportPhone = shopSupportPhone == null ? "9999999999" : shopSupportPhone.trim();
    }

    public record PreferenceDto(
            Long userId,
            boolean whatsappOptIn,
            LocalDateTime consentTimestamp,
            NotificationLanguage preferredLanguage,
            boolean cloudApiEnabled) {}

    public record OrderNotificationDto(
            Long orderId,
            NotificationEventType eventType,
            OrderStatus currentOrderStatus,
            NotificationLanguage language,
            boolean customerOptedIn,
            boolean alreadyNotified,
            NotificationChannel channel,
            NotificationStatus deliveryStatus,
            String messageText,
            String waMeUrl,
            String supportWaMeUrl) {}

    public record NotificationLogDto(
            Long id,
            Long orderId,
            NotificationEventType eventType,
            NotificationChannel channel,
            NotificationLanguage language,
            NotificationStatus status,
            LocalDateTime createdAt) {
        public static NotificationLogDto from(NotificationLog log) {
            return new NotificationLogDto(
                    log.getId(),
                    log.getOrderId(),
                    log.getEventType(),
                    log.getChannel(),
                    log.getLanguage(),
                    log.getStatus(),
                    log.getCreatedAt());
        }
    }

    @Transactional(readOnly = true)
    public PreferenceDto getPreference(String userPhone) {
        User u = users.findByPhone(userPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"));
        Optional<NotificationPreference> pref = preferences.findByUserId(u.getId());
        if (pref.isEmpty()) {
            return new PreferenceDto(
                    u.getId(),
                    false,
                    null,
                    NotificationLanguage.EN,
                    cloudProvider.isConfiguredAndEnabled());
        }
        NotificationPreference p = pref.get();
        return new PreferenceDto(
                u.getId(),
                p.isWhatsappOptIn(),
                p.getConsentTimestamp(),
                p.getPreferredLanguage(),
                cloudProvider.isConfiguredAndEnabled());
    }

    @Transactional
    public PreferenceDto updatePreference(
            String userPhone,
            boolean whatsappOptIn,
            NotificationLanguage preferredLanguage) {
        User u = users.findByPhone(userPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"));

        NotificationPreference p = preferences.findByUserId(u.getId())
                .orElseGet(() -> {
                    NotificationPreference fresh = new NotificationPreference();
                    fresh.setUserId(u.getId());
                    return fresh;
                });

        p.setWhatsappOptIn(whatsappOptIn);
        p.setConsentTimestamp(LocalDateTime.now());
        p.setPreferredLanguage(preferredLanguage == null ? NotificationLanguage.EN : preferredLanguage);

        NotificationPreference saved = preferences.save(p);
        return new PreferenceDto(
                u.getId(),
                saved.isWhatsappOptIn(),
                saved.getConsentTimestamp(),
                saved.getPreferredLanguage(),
                cloudProvider.isConfiguredAndEnabled());
    }

    /**
     * Customer-facing order share & WhatsApp support link for their own order.
     */
    @Transactional(readOnly = true)
    public OrderNotificationDto buildCustomerOrderShare(
            Long orderId,
            String customerPhone,
            NotificationLanguage overrideLanguage) {

        User customer = users.findByPhone(customerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"));

        CustomerOrder order = orders.findWithDetailsByIdAndCustomerId(orderId, customer.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        NotificationPreference pref = preferences.findByUserId(customer.getId()).orElse(null);
        NotificationLanguage lang = overrideLanguage != null
                ? overrideLanguage
                : (pref != null ? pref.getPreferredLanguage() : NotificationLanguage.EN);

        NotificationEventType eventType = mapStatusToEvent(order.getStatus());
        BigDecimal bill = order.getFinalTotal() != null ? order.getFinalTotal() : order.getEstimatedTotal();

        String message = OrderMessageTemplates.formatOrderMessage(
                eventType, lang, order.getId(), customer.getFullName(), bill);
        String customerWaUrl = OrderMessageTemplates.buildWaMeUrl(customer.getPhone(), message);

        String supportQuery = "Hello TazaTokri! Regarding my order #" + order.getId()
                + " (status: " + order.getStatus() + ")";
        String supportWaUrl = OrderMessageTemplates.buildWaMeUrl(shopSupportPhone, supportQuery);

        return new OrderNotificationDto(
                order.getId(),
                eventType,
                order.getStatus(),
                lang,
                pref != null && pref.isWhatsappOptIn(),
                false,
                NotificationChannel.WHATSAPP_MANUAL,
                NotificationStatus.PREPARED,
                message,
                customerWaUrl,
                supportWaUrl);
    }

    /**
     * Staff/Delivery-triggered order status notification with duplicate-event protection,
     * transition validation, customer consent enforcement, and optional Cloud API dispatch.
     */
    @Transactional
    public OrderNotificationDto triggerOrderEventNotification(
            Long orderId,
            NotificationEventType eventType,
            NotificationLanguage overrideLanguage) {

        CustomerOrder order = orders.findWithDetailsById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        validateEventTransition(order.getStatus(), eventType);

        User customer = users.findById(order.getCustomerId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found for order #" + orderId));

        NotificationPreference pref = preferences.findByUserId(customer.getId()).orElse(null);
        boolean optedIn = pref != null && pref.isWhatsappOptIn();
        NotificationLanguage lang = overrideLanguage != null
                ? overrideLanguage
                : (pref != null ? pref.getPreferredLanguage() : NotificationLanguage.EN);

        BigDecimal bill = order.getFinalTotal() != null ? order.getFinalTotal() : order.getEstimatedTotal();
        String message = OrderMessageTemplates.formatOrderMessage(
                eventType, lang, order.getId(), customer.getFullName(), bill);
        String waMeUrl = OrderMessageTemplates.buildWaMeUrl(customer.getPhone(), message);
        String supportWaUrl = OrderMessageTemplates.buildWaMeUrl(
                shopSupportPhone, "Order #" + order.getId() + " inquiry");

        NotificationChannel targetChannel = cloudProvider.isConfiguredAndEnabled()
                ? NotificationChannel.WHATSAPP_CLOUD_API
                : NotificationChannel.WHATSAPP_MANUAL;

        // Idempotency / duplicate-event guard: never record or send the same (orderId, eventType, channel) twice
        Optional<NotificationLog> existing = logs.findByOrderIdAndEventTypeAndChannel(
                order.getId(), eventType, targetChannel);
        if (existing.isPresent()) {
            NotificationLog prev = existing.get();
            return new OrderNotificationDto(
                    order.getId(),
                    eventType,
                    order.getStatus(),
                    prev.getLanguage(),
                    optedIn,
                    true,
                    prev.getChannel(),
                    prev.getStatus(),
                    message,
                    waMeUrl,
                    supportWaUrl);
        }

        NotificationLog log = new NotificationLog();
        log.setOrderId(order.getId());
        log.setCustomerId(customer.getId());
        log.setEventType(eventType);
        log.setChannel(targetChannel);
        log.setLanguage(lang);

        if (!optedIn) {
            log.setStatus(NotificationStatus.SKIPPED_NO_CONSENT);
            log.setErrorDetail("Customer has not opted in to WhatsApp notifications");
        } else if (targetChannel == NotificationChannel.WHATSAPP_CLOUD_API) {
            WhatsAppCloudApiProvider.CloudSendResult sendRes =
                    cloudProvider.sendTemplateOrText(customer.getPhone(), message);
            log.setStatus(sendRes.status());
            log.setProviderMessageId(sendRes.providerMessageId());
            log.setErrorDetail(sendRes.errorDetail());
        } else {
            log.setStatus(NotificationStatus.PREPARED);
        }

        NotificationLog saved = logs.save(log);
        return new OrderNotificationDto(
                order.getId(),
                eventType,
                order.getStatus(),
                lang,
                optedIn,
                false,
                saved.getChannel(),
                saved.getStatus(),
                message,
                waMeUrl,
                supportWaUrl);
    }

    @Transactional(readOnly = true)
    public List<NotificationLogDto> listLogsForOrder(Long orderId) {
        return logs.findByOrderIdOrderByCreatedAtDescIdDesc(orderId)
                .stream()
                .map(NotificationLogDto::from)
                .toList();
    }

    public static NotificationEventType mapStatusToEvent(OrderStatus status) {
        return switch (status) {
            case PENDING_PAYMENT, PLACED -> NotificationEventType.ORDER_PLACED;
            case CONFIRMED -> NotificationEventType.ORDER_CONFIRMED;
            case PACKED -> NotificationEventType.ORDER_PACKED;
            case OUT_FOR_DELIVERY -> NotificationEventType.OUT_FOR_DELIVERY;
            case DELIVERED -> NotificationEventType.DELIVERED;
            case CANCELLED -> NotificationEventType.CANCELLED;
        };
    }

    public static void validateEventTransition(OrderStatus currentStatus, NotificationEventType eventType) {
        Set<OrderStatus> allowedStatuses = switch (eventType) {
            case ORDER_PLACED -> EnumSet.of(
                    OrderStatus.PENDING_PAYMENT,
                    OrderStatus.PLACED,
                    OrderStatus.CONFIRMED,
                    OrderStatus.PACKED,
                    OrderStatus.OUT_FOR_DELIVERY,
                    OrderStatus.DELIVERED);
            case ORDER_CONFIRMED -> EnumSet.of(
                    OrderStatus.CONFIRMED,
                    OrderStatus.PACKED,
                    OrderStatus.OUT_FOR_DELIVERY,
                    OrderStatus.DELIVERED);
            case ORDER_PACKED -> EnumSet.of(
                    OrderStatus.PACKED,
                    OrderStatus.OUT_FOR_DELIVERY,
                    OrderStatus.DELIVERED);
            case OUT_FOR_DELIVERY -> EnumSet.of(
                    OrderStatus.OUT_FOR_DELIVERY,
                    OrderStatus.DELIVERED);
            case DELIVERED -> EnumSet.of(OrderStatus.DELIVERED);
            case CANCELLED -> EnumSet.of(OrderStatus.CANCELLED);
        };

        if (!allowedStatuses.contains(currentStatus)) {
            throw new InvalidOrderStateException(
                    "Cannot send " + eventType + " notification while order is in status " + currentStatus);
        }
    }
}
