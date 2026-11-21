package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;

import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderFlowService;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.retention.PromoDiscountType;
import com.tazatokri.retention.PromoOffer;
import com.tazatokri.retention.PromoOfferRepository;
import com.tazatokri.retention.PromoOfferService;
import com.tazatokri.retention.PromoOfferService.PromoOfferRequest;
import com.tazatokri.retention.PromoRedemption;
import com.tazatokri.retention.PromoRedemptionRepository;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class PromoReleaseOnCancelExpiryTests {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-11-21T10:00:00Z"), IST);

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    @Test
    void releasesPromoRedemptionOnOrderCancelAndPaymentExpirySafely() {
        Map<Long, PromoOffer> offerStore = new ConcurrentHashMap<>();
        Map<Long, PromoRedemption> redemptionByOrder = new ConcurrentHashMap<>();
        Map<Long, CustomerOrder> orderStore = new ConcurrentHashMap<>();
        AtomicLong offerSeq = new AtomicLong(1);
        AtomicLong redemptionSeq = new AtomicLong(1);
        AtomicInteger deleteCount = new AtomicInteger(0);

        User customer = new User();
        customer.setId(10L);
        customer.setPhone("9876543210");
        customer.setFullName("Asha");

        PromoOfferRepository offerRepo = proxy(PromoOfferRepository.class, (p, m, a) -> switch (m.getName()) {
            case "save" -> {
                PromoOffer o = (PromoOffer) a[0];
                if (o.getId() == null) o.setId(offerSeq.getAndIncrement());
                offerStore.put(o.getId(), o);
                yield o;
            }
            case "findByCodeIgnoreCase", "findByCodeIgnoreCaseForUpdate" -> {
                String code = ((String) a[0]).trim();
                yield offerStore.values().stream()
                        .filter(o -> o.getCode().equalsIgnoreCase(code))
                        .findFirst();
            }
            case "findByIdForUpdate" -> Optional.ofNullable(offerStore.get((Long) a[0]));
            default -> throw new UnsupportedOperationException("PromoOfferRepository." + m.getName());
        });

        PromoRedemptionRepository redemptionRepo = proxy(PromoRedemptionRepository.class, (p, m, a) -> switch (m.getName()) {
            case "save" -> {
                PromoRedemption r = (PromoRedemption) a[0];
                if (r.getId() == null) r.setId(redemptionSeq.getAndIncrement());
                redemptionByOrder.put(r.getOrderId(), r);
                yield r;
            }
            case "existsByOrderId" -> redemptionByOrder.containsKey((Long) a[0]);
            case "findByOrderId" -> Optional.ofNullable(redemptionByOrder.get((Long) a[0]));
            case "delete" -> {
                PromoRedemption r = (PromoRedemption) a[0];
                if (redemptionByOrder.remove(r.getOrderId()) != null) {
                    deleteCount.incrementAndGet();
                }
                yield null;
            }
            case "countByOfferId" -> redemptionByOrder.values().stream()
                    .filter(r -> r.getOfferId().equals(a[0])).count();
            case "countByOfferIdAndCustomerId" -> redemptionByOrder.values().stream()
                    .filter(r -> r.getOfferId().equals(a[0]) && r.getCustomerId().equals(a[1])).count();
            default -> throw new UnsupportedOperationException("PromoRedemptionRepository." + m.getName());
        });

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByPhone" -> customer.getPhone().equals(a[0]) ? Optional.of(customer) : Optional.empty();
            default -> Optional.empty();
        });

        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByIdForUpdate" -> Optional.ofNullable(orderStore.get((Long) a[0]));
            default -> throw new UnsupportedOperationException("CustomerOrderRepository." + m.getName());
        });

        PaymentService noopPaymentService = new PaymentService(null, null) {
            @Override
            public void queueRefund(Long orderId, BigDecimal finalTotal) {
                // no-op for unit test
            }
        };

        PromoOfferService promoService = new PromoOfferService(offerRepo, redemptionRepo, userRepo, FIXED_CLOCK);
        OrderFlowService flowService = new OrderFlowService(
                orderRepo,
                userRepo,
                new InventoryService(null, null, null),
                noopPaymentService,
                new BigDecimal("20"));
        flowService.setPromoOfferService(promoService);

        promoService.createOffer(
                new PromoOfferRequest(
                        "Single Use", "SAVE50", "Rs 50 off", PromoDiscountType.FIXED,
                        new BigDecimal("50"), new BigDecimal("200"), null,
                        LocalDateTime.of(2026, 11, 20, 0, 0),
                        LocalDateTime.of(2026, 11, 30, 23, 59),
                        1, 1, true),
                customer.getPhone());

        // 1. Place PLACED order with SAVE50
        var applied1 = promoService.validateAndLockForOrder(
                "SAVE50", customer.getId(), new BigDecimal("300.00"), BigDecimal.ZERO);
        promoService.recordRedemption(applied1, customer.getId(), 101L);

        CustomerOrder order1 = new CustomerOrder();
        order1.setId(101L);
        order1.setCustomerId(customer.getId());
        order1.setPaymentMethod(OrderPaymentMethod.COD);
        order1.setStatus(OrderStatus.PLACED);
        order1.setSubtotal(new BigDecimal("300.00"));
        order1.setDeliveryFee(BigDecimal.ZERO);
        order1.setPromoCode("SAVE50");
        order1.setPromoDiscountAmount(new BigDecimal("50.00"));
        order1.setEstimatedTotal(new BigDecimal("250.00"));
        orderStore.put(101L, order1);

        assertTrue(redemptionRepo.existsByOrderId(101L));

        // Cancel order 101 -> promo redemption must be released, order financial snapshot preserved
        flowService.cancelByCustomer(101L, "Changed mind", customer.getPhone());
        assertEquals(OrderStatus.CANCELLED, order1.getStatus());
        assertEquals(new BigDecimal("250.00"), order1.getEstimatedTotal());
        assertFalse(redemptionRepo.existsByOrderId(101L));
        assertEquals(1, deleteCount.get());

        // Duplicate cancel must be rejected and must not double-delete
        assertThrows(InvalidOrderStateException.class,
                () -> flowService.cancelByCustomer(101L, "Again", customer.getPhone()));
        assertEquals(1, deleteCount.get());

        // 2. Customer can now reuse SAVE50 on a new PENDING_PAYMENT order (usage limit restored)
        var applied2 = promoService.validateAndLockForOrder(
                "SAVE50", customer.getId(), new BigDecimal("300.00"), BigDecimal.ZERO);
        promoService.recordRedemption(applied2, customer.getId(), 102L);

        CustomerOrder order2 = new CustomerOrder();
        order2.setId(102L);
        order2.setCustomerId(customer.getId());
        order2.setPaymentMethod(OrderPaymentMethod.ONLINE);
        order2.setStatus(OrderStatus.PENDING_PAYMENT);
        order2.setSubtotal(new BigDecimal("300.00"));
        order2.setDeliveryFee(BigDecimal.ZERO);
        order2.setPromoCode("SAVE50");
        order2.setPromoDiscountAmount(new BigDecimal("50.00"));
        order2.setEstimatedTotal(new BigDecimal("250.00"));
        orderStore.put(102L, order2);

        // Expire order 102 -> promo redemption released
        flowService.expireLocked(order2, customer.getPhone());
        assertEquals(OrderStatus.CANCELLED, order2.getStatus());
        assertFalse(redemptionRepo.existsByOrderId(102L));
        assertEquals(2, deleteCount.get());

        // Duplicate release call is idempotent no-op
        promoService.releaseRedemptionForCancelledOrder(102L);
        assertEquals(2, deleteCount.get());

        // 3. Valid order 103 keeps its redemption intact
        var applied3 = promoService.validateAndLockForOrder(
                "SAVE50", customer.getId(), new BigDecimal("300.00"), BigDecimal.ZERO);
        promoService.recordRedemption(applied3, customer.getId(), 103L);
        assertTrue(redemptionRepo.existsByOrderId(103L));
    }
}
