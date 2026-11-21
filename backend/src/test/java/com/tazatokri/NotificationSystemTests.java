package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.notification.NotificationChannel;
import com.tazatokri.notification.NotificationController;
import com.tazatokri.notification.NotificationEventType;
import com.tazatokri.notification.NotificationLanguage;
import com.tazatokri.notification.NotificationLog;
import com.tazatokri.notification.NotificationLogRepository;
import com.tazatokri.notification.NotificationPreference;
import com.tazatokri.notification.NotificationPreferenceRepository;
import com.tazatokri.notification.NotificationService;
import com.tazatokri.notification.NotificationStatus;
import com.tazatokri.notification.WhatsAppCloudApiProvider;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class NotificationSystemTests {

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    private static void setField(Object target, String name, Object value) {
        try {
            Field f = target.getClass().getDeclaredField(name);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void ownerNotificationEndpointsRequireOwnerRole() throws NoSuchMethodException {
        for (String name : List.of("providerStatus", "listRecentLogs", "retryNotification")) {
            Method m = switch (name) {
                case "providerStatus" -> NotificationController.class.getMethod(name);
                case "listRecentLogs" -> NotificationController.class.getMethod(name, NotificationStatus.class);
                default -> NotificationController.class.getMethod(name, Long.class);
            };
            PreAuthorize ann = m.getAnnotation(PreAuthorize.class);
            assertNotNull(ann);
            assertEquals("hasRole('OWNER')", ann.value());
        }
    }

    @Test
    void mapsAllOrderStatusesToNotificationEvents() {
        assertEquals(NotificationEventType.ORDER_PLACED, NotificationService.mapStatusToEvent(OrderStatus.PLACED));
        assertEquals(NotificationEventType.ORDER_CONFIRMED, NotificationService.mapStatusToEvent(OrderStatus.CONFIRMED));
        assertEquals(NotificationEventType.ORDER_PACKED, NotificationService.mapStatusToEvent(OrderStatus.PACKED));
        assertEquals(NotificationEventType.OUT_FOR_DELIVERY, NotificationService.mapStatusToEvent(OrderStatus.OUT_FOR_DELIVERY));
        assertEquals(NotificationEventType.DELIVERED, NotificationService.mapStatusToEvent(OrderStatus.DELIVERED));
        assertEquals(NotificationEventType.CANCELLED, NotificationService.mapStatusToEvent(OrderStatus.CANCELLED));
    }

    @Test
    void deduplicatesEventsRetriesTransientFailuresAndNeverBlocksOrders() {
        List<NotificationLog> store = new ArrayList<>();
        AtomicInteger providerCalls = new AtomicInteger(0);

        CustomerOrder order = new CustomerOrder();
        setField(order, "id", 101L);
        order.setCustomerId(1L);
        order.setStatus(OrderStatus.CONFIRMED);
        order.setEstimatedTotal(new BigDecimal("250.00"));

        User customer = new User();
        setField(customer, "id", 1L);
        customer.setFullName("Anita");
        customer.setPhone("9822011223");

        NotificationPreference pref = new NotificationPreference();
        pref.setUserId(1L);
        pref.setWhatsappOptIn(true);
        pref.setPreferredLanguage(NotificationLanguage.EN);

        NotificationPreferenceRepository prefRepo = proxy(NotificationPreferenceRepository.class, (p, m, a) ->
                "findByUserId".equals(m.getName()) ? Optional.of(pref) : Optional.empty());

        NotificationLogRepository logRepo = proxy(NotificationLogRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByOrderIdAndEventTypeAndChannel" -> store.stream()
                    .filter(l -> l.getOrderId().equals(a[0]) && l.getEventType() == a[1] && l.getChannel() == a[2])
                    .findFirst();
            case "findById" -> store.stream().filter(l -> l.getId().equals(a[0])).findFirst();
            case "save" -> {
                NotificationLog l = (NotificationLog) a[0];
                if (l.getId() == null) {
                    setField(l, "id", (long) (store.size() + 1));
                    store.add(l);
                }
                yield l;
            }
            case "findAllByOrderByCreatedAtDescIdDesc" -> store;
            default -> List.of();
        });

        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) ->
                "findWithDetailsById".equals(m.getName()) && Long.valueOf(101L).equals(a[0])
                        ? Optional.of(order)
                        : Optional.empty());

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) ->
                "findById".equals(m.getName()) && Long.valueOf(1L).equals(a[0])
                        ? Optional.of(customer)
                        : Optional.empty());

        WhatsAppCloudApiProvider stubProvider = new WhatsAppCloudApiProvider(
                true, "phone-id", "secret-token", "waba-id", "v21.0", "") {
            @Override
            public CloudSendResult sendTemplateOrText(String recipientPhone, String messageText) {
                int n = providerCalls.incrementAndGet();
                if (n == 1) {
                    return new CloudSendResult(NotificationStatus.FAILED, null, "HTTP 429 rate limited");
                }
                return new CloudSendResult(NotificationStatus.SENT, "wamid.123", null);
            }
        };

        NotificationService service = new NotificationService(
                prefRepo, logRepo, orderRepo, userRepo, stubProvider, "9999999999");

        // First trigger fails transiently
        var first = service.triggerOrderEventNotification(101L, NotificationEventType.ORDER_CONFIRMED, null);
        assertFalse(first.alreadyNotified());
        assertEquals(NotificationStatus.FAILED, first.deliveryStatus());
        assertEquals(1, providerCalls.get());

        // Duplicate trigger is deduplicated (does NOT re-call provider)
        var duplicate = service.triggerOrderEventNotification(101L, NotificationEventType.ORDER_CONFIRMED, null);
        assertTrue(duplicate.alreadyNotified());
        assertEquals(1, providerCalls.get());

        // Retry succeeds and updates log to SENT
        var retried = service.retryFailedNotification(1L);
        assertEquals(NotificationStatus.SENT, retried.status());
        assertEquals(2, providerCalls.get());

        // Retrying an already SENT log is rejected
        assertThrows(BadRequestException.class, () -> service.retryFailedNotification(1L));

        // Non-blocking safe dispatch swallows errors for missing order
        service.notifyOrderStatusSafely(9999L, OrderStatus.PLACED);

        // Provider status does not expose secrets
        var status = service.getProviderStatus();
        assertTrue(status.cloudApiEnabled());
        assertTrue(status.hasBusinessAccountId());
    }
}
