package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.delivery.DeliveryAttempt;
import com.tazatokri.delivery.DeliveryAttemptRepository;
import com.tazatokri.delivery.DeliveryAuditLog;
import com.tazatokri.delivery.DeliveryAuditLogRepository;
import com.tazatokri.delivery.DeliveryOtpRepository;
import com.tazatokri.delivery.DeliveryService;
import com.tazatokri.delivery.DeliveryStatus;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.payment.CollectionRequest;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class DeliverySimplificationTests {

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    @Test
    void unassignReassignFailAndRecipientHandoverDelivery() {
        Map<Long, DeliveryAttempt> attemptStore = new ConcurrentHashMap<>();
        AtomicLong attemptSeq = new AtomicLong(1);
        List<DeliveryAuditLog> audits = new ArrayList<>();
        AtomicLong auditSeq = new AtomicLong(1);

        User staff = new User();
        staff.setId(1L);
        staff.setFullName("Staff");
        staff.setPhone("9000000001");
        staff.setRoles(Set.of(Role.STAFF));

        User rider1 = new User();
        rider1.setId(2L);
        rider1.setFullName("Raju");
        rider1.setPhone("9111111111");
        rider1.setRoles(Set.of(Role.DELIVERY));
        rider1.setActive(true);

        User rider2 = new User();
        rider2.setId(3L);
        rider2.setFullName("Mohan");
        rider2.setPhone("9222222222");
        rider2.setRoles(Set.of(Role.DELIVERY));
        rider2.setActive(true);

        CustomerOrder order = new CustomerOrder();
        order.setId(500L);
        order.setCustomerId(10L);
        order.setStatus(OrderStatus.PACKED);
        order.setPaymentMethod(OrderPaymentMethod.COD);
        order.setDeliveryDate(LocalDate.now());
        order.setDeliveryAddress("MG Road");
        order.setDeliveryPincode("411001");
        order.setFinalTotal(new BigDecimal("180.00"));

        DeliveryAttemptRepository attemptRepo = proxy(DeliveryAttemptRepository.class, (p, m, a) -> switch (m.getName()) {
            case "save" -> {
                DeliveryAttempt da = (DeliveryAttempt) a[0];
                if (da.getId() == null) da.setId(attemptSeq.getAndIncrement());
                attemptStore.put(da.getId(), da);
                yield da;
            }
            case "findFirstByOrderIdAndStatusIn" -> {
                Long oid = (Long) a[0];
                @SuppressWarnings("unchecked")
                List<DeliveryStatus> statuses = (List<DeliveryStatus>) a[1];
                yield attemptStore.values().stream()
                        .filter(da -> da.getOrderId().equals(oid) && statuses.contains(da.getStatus()))
                        .findFirst();
            }
            case "findFirstByOrderIdOrderByIdDesc" -> {
                Long oid = (Long) a[0];
                yield attemptStore.values().stream()
                        .filter(da -> da.getOrderId().equals(oid))
                        .max((x, y) -> Long.compare(x.getId(), y.getId()));
            }
            default -> throw new UnsupportedOperationException("DeliveryAttemptRepository." + m.getName());
        });

        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByIdForUpdate" -> order.getId().equals(a[0]) ? Optional.of(order) : Optional.empty();
            default -> throw new UnsupportedOperationException("CustomerOrderRepository." + m.getName());
        });

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByPhone" -> {
                String ph = (String) a[0];
                if (staff.getPhone().equals(ph)) yield Optional.of(staff);
                if (rider1.getPhone().equals(ph)) yield Optional.of(rider1);
                if (rider2.getPhone().equals(ph)) yield Optional.of(rider2);
                yield Optional.empty();
            }
            case "findById" -> {
                Long id = (Long) a[0];
                if (id.equals(2L)) yield Optional.of(rider1);
                if (id.equals(3L)) yield Optional.of(rider2);
                yield Optional.empty();
            }
            default -> Optional.empty();
        });

        DeliveryOtpRepository otpRepo = proxy(DeliveryOtpRepository.class, (p, m, a) -> List.of());
        DeliveryAuditLogRepository auditRepo = proxy(DeliveryAuditLogRepository.class, (p, m, a) -> {
            if ("save".equals(m.getName())) {
                DeliveryAuditLog log = (DeliveryAuditLog) a[0];
                log.setId(auditSeq.getAndIncrement());
                audits.add(log);
                return log;
            }
            return List.of();
        });

        List<BigDecimal> collectedAmounts = new ArrayList<>();
        PaymentService paymentService = new PaymentService(null, null) {
            @Override
            public void collectOnDelivery(CustomerOrder o, Long collectorId, CollectionRequest req) {
                collectedAmounts.add(req.amountCollected());
            }
        };

        DeliveryService service = new DeliveryService(
                attemptRepo, orderRepo, userRepo, paymentService,
                proxy(PaymentRepository.class, (p, m, a) -> List.of()),
                otpRepo, null, auditRepo, null, new BCryptPasswordEncoder(), null,
                30, 5, false);

        // 1. Assign to rider1 -> start -> unassign -> order returns to PACKED
        service.assign(500L, 2L, staff.getPhone());
        service.start(500L, rider1.getPhone());
        assertEquals(OrderStatus.OUT_FOR_DELIVERY, order.getStatus());

        var unassigned = service.unassign(500L, "Rider vehicle issue", staff.getPhone());
        assertEquals(DeliveryStatus.UNASSIGNED, unassigned.status());
        assertEquals(OrderStatus.PACKED, order.getStatus());

        // 2. Assign to rider2 -> start -> fail -> order returns to PACKED, no COD collected
        service.assign(500L, 3L, staff.getPhone());
        service.start(500L, rider2.getPhone());
        var failed = service.fail(500L, "Customer not at home", rider2.getPhone());
        assertEquals(DeliveryStatus.FAILED, failed.status());
        assertEquals(OrderStatus.PACKED, order.getStatus());
        assertTrue(collectedAmounts.isEmpty());

        // 3. Reassign after failed attempt -> start
        service.assign(500L, 2L, staff.getPhone());
        service.start(500L, rider1.getPhone());

        // Without OTP AND without recipientName, deliver still rejects
        assertThrows(BadRequestException.class, () -> service.deliver(
                500L, new CollectionRequest(PaymentMethod.CASH, new BigDecimal("180.00"), null), rider1.getPhone()));

        // With recipientName = "Family member" (no OTP needed), deliver succeeds & collects COD
        var delivered = service.deliver(
                500L,
                new CollectionRequest(PaymentMethod.CASH, new BigDecimal("180.00"), null,
                        "Family member", "Handed to mother"),
                rider1.getPhone());

        assertEquals(DeliveryStatus.DELIVERED, delivered.status());
        assertEquals(OrderStatus.DELIVERED, order.getStatus());
        assertEquals("RECIPIENT_HANDOVER", delivered.otpVerificationMethod());
        assertEquals("Handed to mother", delivered.deliveryNote());
        assertEquals(1, collectedAmounts.size());
        assertEquals(new BigDecimal("180.00"), collectedAmounts.get(0));
        assertFalse(audits.isEmpty());
    }
}
