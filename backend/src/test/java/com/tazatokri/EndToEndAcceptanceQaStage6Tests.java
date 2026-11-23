package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
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

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.catalog.VegetableUnit;
import com.tazatokri.pricing.PriceSource;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.delivery.DeliveryAttempt;
import com.tazatokri.delivery.DeliveryAttemptRepository;
import com.tazatokri.delivery.DeliveryAuditLog;
import com.tazatokri.delivery.DeliveryAuditLogRepository;
import com.tazatokri.delivery.DeliveryOtpRepository;
import com.tazatokri.delivery.DeliveryRules;
import com.tazatokri.delivery.DeliveryService;
import com.tazatokri.delivery.DeliveryStatus;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.inventory.StockMovement;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderFlowService;
import com.tazatokri.order.OrderItemRequest;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.order.OrderResponse;
import com.tazatokri.order.OrderService;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.order.PackRequest;
import com.tazatokri.order.PlaceOrderRequest;
import com.tazatokri.payment.CollectionRequest;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.user.Address;
import com.tazatokri.user.AddressRepository;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class EndToEndAcceptanceQaStage6Tests {

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    @Test
    void fullCrossModuleCodDeliveryAndOnlineCancelJourneys() {
        Map<Long, CustomerOrder> orderStore = new ConcurrentHashMap<>();
        AtomicLong orderSeq = new AtomicLong(1000);
        Map<Long, DeliveryAttempt> attemptStore = new ConcurrentHashMap<>();
        AtomicLong attemptSeq = new AtomicLong(1);
        List<String> stockLog = new ArrayList<>();
        List<String> refundLog = new ArrayList<>();
        AtomicInteger codCollected = new AtomicInteger(0);

        User customer = new User();
        customer.setId(10L);
        customer.setPhone("9876543210");
        customer.setFullName("Asha Patil");
        customer.setRoles(Set.of(Role.CUSTOMER));

        User staff = new User();
        staff.setId(1L);
        staff.setPhone("9000000001");
        staff.setFullName("Staff");
        staff.setRoles(Set.of(Role.STAFF));

        User rider = new User();
        rider.setId(2L);
        rider.setPhone("9111111111");
        rider.setFullName("Raju");
        rider.setRoles(Set.of(Role.DELIVERY));
        rider.setActive(true);

        Address addr = new Address();
        addr.setId(1L);
        addr.setUserId(10L);
        addr.setLabel("Home");
        addr.setLine1("101 MG Road");
        addr.setPincode("411001");
        addr.setActive(true);

        Vegetable tomato = new Vegetable();
        tomato.setId(1L);
        tomato.setNameEn("Tomato");
        tomato.setActive(true);
        tomato.setAvailable(true);
        VegetableUnit kg1 = new VegetableUnit();
        kg1.setId(11L);
        kg1.setVegetable(tomato);
        kg1.setLabel("1 kg");
        kg1.setQuantityInBaseUnit(new BigDecimal("1.000"));
        kg1.setActive(true);
        tomato.setUnits(List.of(kg1));

        VegetablePrice price = new VegetablePrice(
                tomato, new BigDecimal("80.00"), PriceSource.MANUAL, "QA", 1L);

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByPhone" -> {
                String ph = (String) a[0];
                if (customer.getPhone().equals(ph)) yield Optional.of(customer);
                if (staff.getPhone().equals(ph)) yield Optional.of(staff);
                if (rider.getPhone().equals(ph)) yield Optional.of(rider);
                yield Optional.empty();
            }
            case "findById" -> rider.getId().equals(a[0]) ? Optional.of(rider) : Optional.empty();
            default -> throw new UnsupportedOperationException("UserRepository." + m.getName());
        });

        AddressRepository addrRepo = proxy(AddressRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByIdAndUserId" -> (addr.getId().equals(a[0]) && addr.getUserId().equals(a[1]))
                    ? Optional.of(addr)
                    : Optional.empty();
            default -> throw new UnsupportedOperationException("AddressRepository." + m.getName());
        });

        VegetableRepository vegRepo = proxy(VegetableRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findWithDetailsById" -> tomato.getId().equals(a[0]) ? Optional.of(tomato) : Optional.empty();
            default -> throw new UnsupportedOperationException("VegetableRepository." + m.getName());
        });

        VegetablePriceRepository priceRepo = proxy(VegetablePriceRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findFirstByVegetableIdOrderByIdDesc" -> tomato.getId().equals(a[0])
                    ? Optional.of(price)
                    : Optional.empty();
            default -> throw new UnsupportedOperationException("VegetablePriceRepository." + m.getName());
        });

        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findWithDetailsByClientRef" -> orderStore.values().stream()
                    .filter(o -> o.getClientRef().equals(a[0]))
                    .findFirst();
            case "findByIdForUpdate", "findWithDetailsById" -> Optional.ofNullable(orderStore.get((Long) a[0]));
            case "findWithDetailsByIdAndCustomerId" -> {
                CustomerOrder o = orderStore.get((Long) a[0]);
                yield (o != null && o.getCustomerId().equals(a[1])) ? Optional.of(o) : Optional.empty();
            }
            case "save" -> {
                CustomerOrder o = (CustomerOrder) a[0];
                if (o.getId() == null) o.setId(orderSeq.getAndIncrement());
                orderStore.put(o.getId(), o);
                yield o;
            }
            default -> throw new UnsupportedOperationException("CustomerOrderRepository." + m.getName());
        });

        DeliveryAttemptRepository attemptRepo = proxy(DeliveryAttemptRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findFirstByOrderIdAndStatusIn" -> {
                @SuppressWarnings("unchecked")
                List<DeliveryStatus> st = (List<DeliveryStatus>) a[1];
                yield attemptStore.values().stream()
                        .filter(at -> at.getOrderId().equals(a[0]) && st.contains(at.getStatus()))
                        .findFirst();
            }
            case "findFirstByOrderIdOrderByIdDesc" -> attemptStore.values().stream()
                    .filter(at -> at.getOrderId().equals(a[0]))
                    .sorted((x, y) -> Long.compare(y.getId(), x.getId()))
                    .findFirst();
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
            case "save" -> (DeliveryAuditLog) a[0];
            default -> throw new UnsupportedOperationException("DeliveryAuditLogRepository." + m.getName());
        });

        InventoryService inventory = new InventoryService(null, null, null) {
            @Override
            public StockMovement record(Long vegId, MovementType type, BigDecimal qty, String note,
                    String refType, Long refId, String actorPhone) {
                stockLog.add(type + ":" + qty.stripTrailingZeros().toPlainString() + ":" + refId);
                return null;
            }
        };

        PaymentService paymentService = new PaymentService(null, null) {
            @Override
            public void queueRefund(Long orderId, BigDecimal finalTotal) {
                refundLog.add(orderId + ":" + finalTotal.toPlainString());
            }

            @Override
            public void collectOnDelivery(CustomerOrder o, Long collectorId, CollectionRequest req) {
                codCollected.incrementAndGet();
            }
        };

        // Fixed clock at 10:00 IST so store is open and before 18:00 cutoff
        Clock fixedClock = Clock.fixed(Instant.parse("2026-11-22T04:30:00Z"), DeliveryRules.IST);
        DeliveryRules rules = new DeliveryRules(
                List.of("411001"),
                new BigDecimal("150"),
                new BigDecimal("30"),
                new BigDecimal("300"),
                "18:00",
                "Asia/Kolkata",
                fixedClock);

        OrderService orderService = new OrderService(
                orderRepo, userRepo, addrRepo, vegRepo, priceRepo, inventory, rules, null, fixedClock);
        OrderFlowService flowService = new OrderFlowService(
                orderRepo, userRepo, inventory, paymentService, new BigDecimal("20"));
        DeliveryService deliveryService = new DeliveryService(
                attemptRepo, orderRepo, userRepo, paymentService,
                proxy(PaymentRepository.class, (p, m, a) -> List.of()),
                otpRepo, null, auditRepo, null, new BCryptPasswordEncoder(), null,
                30, 5, false);

        // --- Journey A: COD Order (2 * 80 = 160 + 30 delivery fee = 190) ---
        PlaceOrderRequest codReq = new PlaceOrderRequest(
                "e2e-cod-ref-1", 1L, OrderPaymentMethod.COD,
                List.of(new OrderItemRequest(1L, 11L, 2)), List.of(), null, null);
        OrderResponse placed = orderService.place(codReq, customer.getPhone());
        assertEquals(OrderStatus.PLACED, placed.status());
        assertEquals(new BigDecimal("190.00"), placed.estimatedTotal());
        assertTrue(stockLog.contains("ONLINE_SALE:2:" + placed.id()));

        // Idempotent retry with same clientRef returns same order & no extra stock deduction
        int stockCountBeforeRetry = stockLog.size();
        OrderResponse retry = orderService.place(codReq, customer.getPhone());
        assertEquals(placed.id(), retry.id());
        assertEquals(stockCountBeforeRetry, stockLog.size());

        // --- Journey D: Confirm -> Pack -> Assign -> Start -> Deliver ---
        assertEquals(OrderStatus.CONFIRMED, flowService.confirm(placed.id()).status());
        OrderResponse packed = flowService.pack(
                placed.id(),
                new PackRequest(List.of(new PackRequest.Line(1L, new BigDecimal("2.000")))),
                staff.getPhone());
        assertEquals(OrderStatus.PACKED, packed.status());
        assertEquals(new BigDecimal("190.00"), packed.finalTotal());

        deliveryService.assign(placed.id(), rider.getId(), staff.getPhone());
        deliveryService.start(placed.id(), rider.getPhone());
        assertEquals(OrderStatus.OUT_FOR_DELIVERY, orderService.get(placed.id(), customer.getPhone()).status());

        var deliveredAttempt = deliveryService.deliver(
                placed.id(),
                new CollectionRequest(PaymentMethod.CASH, new BigDecimal("190.00"), null, "Asha Patil", null),
                rider.getPhone());
        assertEquals(DeliveryStatus.DELIVERED, deliveredAttempt.status());
        assertEquals(OrderStatus.DELIVERED, orderService.get(placed.id(), customer.getPhone()).status());
        assertEquals(1, codCollected.get());

        // --- Journey C: Online Pending Order -> Customer Cancel -> Stock Restored -> Duplicate Rejected ---
        PlaceOrderRequest onlineReq = new PlaceOrderRequest(
                "e2e-online-ref-2", 1L, OrderPaymentMethod.ONLINE,
                List.of(new OrderItemRequest(1L, 11L, 4)), List.of(), null, null); // 4 * 80 = 320 >= 300 -> free delivery
        OrderResponse onlinePlaced = orderService.place(onlineReq, customer.getPhone());
        assertEquals(OrderStatus.PENDING_PAYMENT, onlinePlaced.status());
        assertEquals(new BigDecimal("0"), onlinePlaced.deliveryFee().stripTrailingZeros());
        assertEquals(new BigDecimal("320.00"), onlinePlaced.estimatedTotal());

        OrderResponse cancelled = flowService.cancelByCustomer(onlinePlaced.id(), "Changed mind", customer.getPhone());
        assertEquals(OrderStatus.CANCELLED, cancelled.status());
        assertTrue(stockLog.contains("ONLINE_CANCEL_RETURN:4:" + onlinePlaced.id()));
        assertTrue(refundLog.contains(onlinePlaced.id() + ":0"));
        assertThrows(InvalidOrderStateException.class,
                () -> flowService.cancelByCustomer(onlinePlaced.id(), "Duplicate", customer.getPhone()));
    }
}
