package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.delivery.DeliveryAttempt;
import com.tazatokri.delivery.DeliveryAttemptRepository;
import com.tazatokri.delivery.DeliveryAuditLog;
import com.tazatokri.delivery.DeliveryAuditLogRepository;
import com.tazatokri.delivery.DeliveryOtpRepository;
import com.tazatokri.delivery.DeliveryService;
import com.tazatokri.delivery.DeliveryStatus;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.inventory.StockMovement;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderFlowService;
import com.tazatokri.order.OrderItem;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.order.OrderResponse;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.order.PackRequest;
import com.tazatokri.payment.CollectionRequest;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;
import com.tazatokri.catalog.Vegetable;

class OrderLifecycleQaStage4Tests {

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    private static CustomerOrder buildOrder(Long id, Long customerId, OrderStatus status, OrderPaymentMethod pm) {
        Vegetable tomato = new Vegetable();
        tomato.setId(1L);
        tomato.setNameEn("Tomato");

        OrderItem item = new OrderItem();
        item.setVegetable(tomato);
        item.setQuantity(new BigDecimal("2.000"));
        item.setUnitPrice(new BigDecimal("40.00"));
        item.setEstimatedLineTotal(new BigDecimal("80.00"));

        CustomerOrder o = new CustomerOrder();
        o.setId(id);
        o.setCustomerId(customerId);
        o.setStatus(status);
        o.setPaymentMethod(pm);
        o.setDeliveryDate(LocalDate.now());
        o.setSubtotal(new BigDecimal("80.00"));
        o.setDeliveryFee(new BigDecimal("20.00"));
        o.setEstimatedTotal(new BigDecimal("100.00"));
        o.getItems().add(item);
        return o;
    }

    @Test
    void orderFlowLifecycleTransitionsAndCancellationRules() {
        Map<Long, CustomerOrder> orderStore = new ConcurrentHashMap<>();
        List<String> inventoryEvents = new ArrayList<>();
        List<String> refundEvents = new ArrayList<>();

        User customer = new User();
        customer.setId(10L);
        customer.setPhone("9876543210");
        customer.setFullName("Asha");
        customer.setRoles(Set.of(Role.CUSTOMER));

        CustomerOrder placedOrder = buildOrder(101L, 10L, OrderStatus.PLACED, OrderPaymentMethod.COD);
        orderStore.put(101L, placedOrder);

        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByIdForUpdate" -> Optional.ofNullable(orderStore.get((Long) a[0]));
            case "save" -> {
                CustomerOrder o = (CustomerOrder) a[0];
                orderStore.put(o.getId(), o);
                yield o;
            }
            default -> throw new UnsupportedOperationException("CustomerOrderRepository." + m.getName());
        });

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByPhone" -> customer.getPhone().equals(a[0]) ? Optional.of(customer) : Optional.empty();
            default -> throw new UnsupportedOperationException("UserRepository." + m.getName());
        });

        InventoryService inventory = new InventoryService(null, null, null) {
            @Override
            public StockMovement record(
                    Long vegetableId,
                    MovementType type,
                    BigDecimal quantity,
                    String note,
                    String refType,
                    Long refId,
                    String actorPhone) {
                inventoryEvents.add(type + ":" + quantity.stripTrailingZeros().toPlainString() + ":" + refId);
                return null;
            }
        };

        PaymentService paymentService = new PaymentService(null, null) {
            @Override
            public void queueRefund(Long orderId, BigDecimal finalTotal) {
                refundEvents.add(orderId + ":" + finalTotal.toPlainString());
            }
        };

        OrderFlowService flow = new OrderFlowService(
                orderRepo,
                userRepo,
                inventory,
                paymentService,
                new BigDecimal("20"));

        // Invalid pack before confirm
        PackRequest packReq = new PackRequest(List.of(new PackRequest.Line(1L, new BigDecimal("2.200"))));
        assertThrows(InvalidOrderStateException.class, () -> flow.pack(101L, packReq, "9000000001"));

        // Confirm: PLACED -> CONFIRMED
        OrderResponse confirmed = flow.confirm(101L);
        assertEquals(OrderStatus.CONFIRMED, confirmed.status());
        // Duplicate confirm rejected
        assertThrows(InvalidOrderStateException.class, () -> flow.confirm(101L));

        // Pack: CONFIRMED -> PACKED (2.200 kg * 40 = 88.00 + 20.00 fee = 108.00)
        OrderResponse packed = flow.pack(101L, packReq, "9000000001");
        assertEquals(OrderStatus.PACKED, packed.status());
        assertEquals(new BigDecimal("108.00"), packed.finalTotal());
        assertTrue(inventoryEvents.contains("ONLINE_SALE:0.2:101"));
        assertTrue(refundEvents.contains("101:108.00"));

        // Customer cannot cancel once PACKED
        assertThrows(InvalidOrderStateException.class,
                () -> flow.cancelByCustomer(101L, "Changed mind", customer.getPhone()));

        // Staff (non-owner) cannot cancel PACKED
        assertThrows(InvalidOrderStateException.class,
                () -> flow.cancelByStaff(101L, "Out of stock", "9000000001", false));

        // Owner CAN cancel PACKED -> restores actualQuantity (2.200) and queues refund 0
        OrderResponse cancelled = flow.cancelByStaff(101L, "Damaged crate", "9000000009", true);
        assertEquals(OrderStatus.CANCELLED, cancelled.status());
        assertEquals("Damaged crate", orderStore.get(101L).getCancelReason());
        assertTrue(inventoryEvents.contains("ONLINE_CANCEL_RETURN:2.2:101"));
        assertTrue(refundEvents.contains("101:0"));

        // Terminal CANCELLED cannot be cancelled again, confirmed, or packed
        assertThrows(InvalidOrderStateException.class,
                () -> flow.cancelByStaff(101L, "Retry", "9000000009", true));
        assertThrows(InvalidOrderStateException.class, () -> flow.confirm(101L));
        assertThrows(InvalidOrderStateException.class, () -> flow.pack(101L, packReq, "9000000001"));

        // Customer cancel allowed on PENDING_PAYMENT
        CustomerOrder pendingOrder = buildOrder(102L, 10L, OrderStatus.PENDING_PAYMENT, OrderPaymentMethod.ONLINE);
        orderStore.put(102L, pendingOrder);
        OrderResponse cancelledPending = flow.cancelByCustomer(102L, "Payment abandoned", customer.getPhone());
        assertEquals(OrderStatus.CANCELLED, cancelledPending.status());
        assertTrue(inventoryEvents.contains("ONLINE_CANCEL_RETURN:2:102"));
        // Duplicate customer cancel rejected safely (no double stock restore)
        int returnsBefore = (int) inventoryEvents.stream().filter(s -> s.endsWith(":102")).count();
        assertThrows(InvalidOrderStateException.class,
                () -> flow.cancelByCustomer(102L, "Duplicate", customer.getPhone()));
        int returnsAfter = (int) inventoryEvents.stream().filter(s -> s.endsWith(":102")).count();
        assertEquals(returnsBefore, returnsAfter);
    }

    @Test
    void deliveryFailureReattemptAndTerminalStateProtection() {
        Map<Long, DeliveryAttempt> attemptStore = new ConcurrentHashMap<>();
        AtomicLong attemptSeq = new AtomicLong(1);
        List<DeliveryAuditLog> audits = new ArrayList<>();
        AtomicLong auditSeq = new AtomicLong(1);
        AtomicInteger codCollections = new AtomicInteger(0);

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

        CustomerOrder order = buildOrder(201L, 10L, OrderStatus.CONFIRMED, OrderPaymentMethod.COD);
        order.setFinalTotal(new BigDecimal("100.00"));

        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByIdForUpdate" -> order.getId().equals(a[0]) ? Optional.of(order) : Optional.empty();
            default -> throw new UnsupportedOperationException("CustomerOrderRepository." + m.getName());
        });

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByPhone" -> {
                String phone = (String) a[0];
                if (staff.getPhone().equals(phone)) yield Optional.of(staff);
                if (rider1.getPhone().equals(phone)) yield Optional.of(rider1);
                yield Optional.empty();
            }
            case "findById" -> rider1.getId().equals(a[0]) ? Optional.of(rider1) : Optional.empty();
            default -> throw new UnsupportedOperationException("UserRepository." + m.getName());
        });

        DeliveryAttemptRepository attemptRepo = proxy(DeliveryAttemptRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findFirstByOrderIdAndStatusIn" -> {
                @SuppressWarnings("unchecked")
                List<DeliveryStatus> statuses = (List<DeliveryStatus>) a[1];
                yield attemptStore.values().stream()
                        .filter(at -> at.getOrderId().equals(a[0]) && statuses.contains(at.getStatus()))
                        .findFirst();
            }
            case "findFirstByOrderIdOrderByIdDesc" -> attemptStore.values().stream()
                    .filter(at -> at.getOrderId().equals(a[0]))
                    .sorted((x, y) -> Long.compare(y.getId(), x.getId()))
                    .findFirst();
            case "findByOrderIdOrderByIdDesc" -> attemptStore.values().stream()
                    .filter(at -> at.getOrderId().equals(a[0]))
                    .sorted((x, y) -> Long.compare(y.getId(), x.getId()))
                    .toList();
            case "save" -> {
                DeliveryAttempt at = (DeliveryAttempt) a[0];
                if (at.getId() == null) at.setId(attemptSeq.getAndIncrement());
                attemptStore.put(at.getId(), at);
                yield at;
            }
            default -> throw new UnsupportedOperationException("DeliveryAttemptRepository." + m.getName());
        });

        DeliveryOtpRepository otpRepo = proxy(DeliveryOtpRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByOrderIdAndStatus" -> List.of();
            case "saveAll" -> a[0];
            default -> throw new UnsupportedOperationException("DeliveryOtpRepository." + m.getName());
        });

        DeliveryAuditLogRepository auditRepo = proxy(DeliveryAuditLogRepository.class, (p, m, a) -> switch (m.getName()) {
            case "save" -> {
                DeliveryAuditLog log = (DeliveryAuditLog) a[0];
                if (log.getId() == null) log.setId(auditSeq.getAndIncrement());
                audits.add(log);
                yield log;
            }
            default -> throw new UnsupportedOperationException("DeliveryAuditLogRepository." + m.getName());
        });

        PaymentService paymentService = new PaymentService(null, null) {
            @Override
            public void collectOnDelivery(CustomerOrder o, Long collectorId, CollectionRequest req) {
                codCollections.incrementAndGet();
            }
        };

        PaymentRepository paymentRepo = proxy(PaymentRepository.class, (p, m, a) -> {
            throw new UnsupportedOperationException("PaymentRepository." + m.getName());
        });

        DeliveryService delivery = new DeliveryService(
                attemptRepo,
                orderRepo,
                userRepo,
                paymentService,
                paymentRepo,
                otpRepo,
                null,
                auditRepo,
                null,
                new BCryptPasswordEncoder(),
                null,
                30,
                5,
                false);

        // Cannot assign while CONFIRMED (must be PACKED)
        assertThrows(InvalidOrderStateException.class,
                () -> delivery.assign(201L, rider1.getId(), staff.getPhone()));

        order.setStatus(OrderStatus.PACKED);
        delivery.assign(201L, rider1.getId(), staff.getPhone());
        delivery.start(201L, rider1.getPhone());
        assertEquals(OrderStatus.OUT_FOR_DELIVERY, order.getStatus());

        // Blank failure reason rejected
        assertThrows(BadRequestException.class,
                () -> delivery.fail(201L, "   ", rider1.getPhone()));

        // Fail delivery -> attempt FAILED, order returns to PACKED for reattempt
        var failed = delivery.fail(201L, "Customer not home", rider1.getPhone());
        assertEquals(DeliveryStatus.FAILED, failed.status());
        assertEquals(OrderStatus.PACKED, order.getStatus());

        // Reassign & reattempt -> DELIVERED with recipient handover
        delivery.assign(201L, rider1.getId(), staff.getPhone());
        delivery.start(201L, rider1.getPhone());
        var delivered = delivery.deliver(
                201L,
                new CollectionRequest(PaymentMethod.CASH, new BigDecimal("100.00"), null, "Asha", null),
                rider1.getPhone());
        assertEquals(DeliveryStatus.DELIVERED, delivered.status());
        assertEquals(OrderStatus.DELIVERED, order.getStatus());
        assertEquals(1, codCollections.get());

        // Terminal DELIVERED order rejects further assign/start/fail/returnToStore
        assertThrows(InvalidOrderStateException.class,
                () -> delivery.assign(201L, rider1.getId(), staff.getPhone()));
        assertThrows(InvalidOrderStateException.class,
                () -> delivery.returnToStore(201L, "Late", staff.getPhone()));
    }
}
