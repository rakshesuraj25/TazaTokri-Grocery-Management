package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.loyalty.LoyaltyController;
import com.tazatokri.loyalty.LoyaltyService;
import com.tazatokri.loyalty.LoyaltyService.UpdateLoyaltySettingsRequest;
import com.tazatokri.loyalty.LoyaltySettings;
import com.tazatokri.loyalty.LoyaltySettingsRepository;
import com.tazatokri.loyalty.LoyaltyTransaction;
import com.tazatokri.loyalty.LoyaltyTransactionRepository;
import com.tazatokri.loyalty.LoyaltyTransactionType;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class LoyaltySystemTests {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

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

    private LoyaltyService buildService(
            LoyaltySettings settings,
            List<LoyaltyTransaction> txStore,
            AtomicBoolean lockCalled) {
        User customer = new User();
        setField(customer, "id", 1L);
        customer.setPhone("9123456789");
        customer.setFullName("Anita");

        User owner = new User();
        setField(owner, "id", 99L);
        owner.setPhone("9999999999");

        LoyaltySettingsRepository settingsRepo = proxy(LoyaltySettingsRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findById" -> Optional.of(settings);
            case "save" -> a[0];
            default -> null;
        });

        LoyaltyTransactionRepository txRepo = proxy(LoyaltyTransactionRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByIdempotencyKey" -> txStore.stream()
                    .filter(t -> t.getIdempotencyKey().equals(a[0]))
                    .findFirst();
            case "findByCustomerIdOrderByCreatedAtDescIdDesc" -> txStore.stream()
                    .filter(t -> t.getCustomerId().equals(a[0]))
                    .toList();
            case "findByOrderIdOrderByIdAsc" -> txStore.stream()
                    .filter(t -> a[0].equals(t.getOrderId()))
                    .toList();
            case "sumActivePointsForCustomer" -> {
                LocalDateTime now = (LocalDateTime) a[1];
                yield txStore.stream()
                        .filter(t -> t.getCustomerId().equals(a[0]))
                        .filter(t -> t.getExpiresAt() == null || t.getExpiresAt().isAfter(now))
                        .mapToLong(LoyaltyTransaction::getPoints)
                        .sum();
            }
            case "save" -> {
                LoyaltyTransaction t = (LoyaltyTransaction) a[0];
                if (t.getId() == null) {
                    setField(t, "id", (long) (txStore.size() + 1));
                    txStore.add(t);
                }
                yield t;
            }
            default -> 0L;
        });

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByPhone" -> "9123456789".equals(a[0]) ? Optional.of(customer)
                    : ("9999999999".equals(a[0]) ? Optional.of(owner) : Optional.empty());
            case "findByIdForUpdate" -> {
                lockCalled.set(true);
                yield Long.valueOf(1L).equals(a[0]) ? Optional.of(customer) : Optional.empty();
            }
            default -> Optional.empty();
        });

        Instant now = ZonedDateTime.of(2026, 11, 21, 14, 0, 0, 0, IST).toInstant();
        return new LoyaltyService(settingsRepo, txRepo, userRepo, Clock.fixed(now, IST));
    }

    @Test
    void ownerEndpointsRequireOwnerRoleAndCustomerScopeUsesAuth() throws NoSuchMethodException {
        Method getOwner = LoyaltyController.class.getMethod("ownerSettings");
        Method putOwner = LoyaltyController.class.getMethod(
                "updateOwnerSettings", UpdateLoyaltySettingsRequest.class,
                org.springframework.security.core.Authentication.class);
        assertEquals("hasRole('OWNER')", getOwner.getAnnotation(PreAuthorize.class).value());
        assertEquals("hasRole('OWNER')", putOwner.getAnnotation(PreAuthorize.class).value());
        assertNotNull(LoyaltyController.class.getMethod(
                "myLoyalty", org.springframework.security.core.Authentication.class));
    }

    @Test
    void validatesLoyaltyConfiguration() {
        LoyaltySettings s = new LoyaltySettings();
        LoyaltyService service = buildService(s, new ArrayList<>(), new AtomicBoolean());

        assertThrows(BadRequestException.class, () -> service.updateSettings(
                new UpdateLoyaltySettingsRequest(true, new BigDecimal("-1"), BigDecimal.ONE, 10, 50, null),
                "9999999999"));
        assertThrows(BadRequestException.class, () -> service.updateSettings(
                new UpdateLoyaltySettingsRequest(true, new BigDecimal("5"), BigDecimal.ZERO, 10, 50, null),
                "9999999999"));
        assertThrows(BadRequestException.class, () -> service.updateSettings(
                new UpdateLoyaltySettingsRequest(true, new BigDecimal("5"), BigDecimal.ONE, 0, 50, null),
                "9999999999"));
        assertThrows(BadRequestException.class, () -> service.updateSettings(
                new UpdateLoyaltySettingsRequest(true, new BigDecimal("5"), BigDecimal.ONE, 100, 50, null),
                "9999999999"));
        assertThrows(BadRequestException.class, () -> service.updateSettings(
                new UpdateLoyaltySettingsRequest(true, new BigDecimal("5"), BigDecimal.ONE, 10, 50, 0),
                "9999999999"));
    }

    @Test
    void awardsEligibleOrderPointsExcludingDeliveryFeeAndPreventsDuplicates() {
        LoyaltySettings s = new LoyaltySettings();
        s.setEnabled(true);
        s.setPointsPer100Inr(new BigDecimal("10.00")); // 10 pts per Rs 100
        List<LoyaltyTransaction> txStore = new ArrayList<>();
        LoyaltyService service = buildService(s, txStore, new AtomicBoolean());

        // Order: items = 250, deliveryFee = 30, loyaltyDiscount = 50 -> finalTotal = 230
        // Eligible = finalTotal (230) - deliveryFee (30) = 200 -> floor(200 * 10 / 100) = 20 pts
        CustomerOrder order = new CustomerOrder();
        setField(order, "id", 501L);
        order.setCustomerId(1L);
        order.setSubtotal(new BigDecimal("250.00"));
        order.setDeliveryFee(new BigDecimal("30.00"));
        order.setLoyaltyPointsRedeemed(50);
        order.setLoyaltyDiscountAmount(new BigDecimal("50.00"));
        order.setEstimatedTotal(new BigDecimal("230.00"));
        order.setFinalTotal(new BigDecimal("230.00"));

        assertEquals(new BigDecimal("200.00"), LoyaltyService.eligibleOrderAmount(order));
        int earnedFirst = service.awardForDeliveredOrder(order);
        int earnedDup = service.awardForDeliveredOrder(order);

        assertEquals(20, earnedFirst);
        assertEquals(0, earnedDup);
        assertEquals(20L, service.getCustomerLoyalty("9123456789").balance());
    }

    @Test
    void redeemsAtomicallyWithLockRejectsInsufficientAndReversesOnCancellation() {
        LoyaltySettings s = new LoyaltySettings();
        s.setEnabled(true);
        s.setPointsPer100Inr(new BigDecimal("5.00"));
        s.setRupeesPerPoint(new BigDecimal("1.00"));
        s.setMinRedeemPoints(20);
        s.setMaxRedeemPointsPerOrder(100);

        List<LoyaltyTransaction> txStore = new ArrayList<>();
        LoyaltyTransaction seed = new LoyaltyTransaction();
        setField(seed, "id", 1L);
        seed.setCustomerId(1L);
        seed.setType(LoyaltyTransactionType.EARN);
        seed.setPoints(60);
        seed.setIdempotencyKey("SEED:1");
        txStore.add(seed);

        AtomicBoolean lockCalled = new AtomicBoolean(false);
        LoyaltyService service = buildService(s, txStore, lockCalled);

        // Insufficient balance (100 > 60)
        assertThrows(BadRequestException.class,
                () -> service.validateAndLockForRedemption(1L, 100, new BigDecimal("250.00")));

        // Valid redemption (40 pts = Rs 40)
        var calc = service.validateAndLockForRedemption(1L, 40, new BigDecimal("250.00"));
        assertTrue(lockCalled.get());
        assertEquals(40, calc.pointsRedeemed());
        assertEquals(new BigDecimal("40.00"), calc.discountAmount());

        service.recordRedemptionForOrder(1L, 701L, calc);
        assertEquals(20L, service.getCustomerLoyalty("9123456789").balance());

        // Order cancelled -> reverses redeemed 40 pts back to 60
        CustomerOrder cancelled = new CustomerOrder();
        setField(cancelled, "id", 701L);
        cancelled.setCustomerId(1L);
        service.reverseForCancelledOrder(cancelled);
        assertEquals(60L, service.getCustomerLoyalty("9123456789").balance());
    }
}
