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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.loyalty.LoyaltyTransactionRepository;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.retention.CustomerSegment;
import com.tazatokri.retention.PromoDiscountType;
import com.tazatokri.retention.PromoOffer;
import com.tazatokri.retention.PromoOfferRepository;
import com.tazatokri.retention.PromoOfferService;
import com.tazatokri.retention.PromoOfferService.PromoOfferRequest;
import com.tazatokri.retention.PromoRedemption;
import com.tazatokri.retention.PromoRedemptionRepository;
import com.tazatokri.retention.RetentionPromoController;
import com.tazatokri.retention.RetentionService;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class RetentionAndPromoTests {

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

    private static User customer(long id, String name, String phone) {
        User u = new User();
        setField(u, "id", id);
        u.setFullName(name);
        u.setPhone(phone);
        u.setRoles(Set.of(Role.CUSTOMER));
        return u;
    }

    @Test
    void ownerEndpointsRequireOwnerRole() throws NoSuchMethodException {
        Method insights = RetentionPromoController.class.getMethod(
                "insights", LocalDate.class, LocalDate.class, Integer.class, BigDecimal.class,
                CustomerSegment.class, String.class, String.class, int.class, int.class);
        Method listOffers = RetentionPromoController.class.getMethod("listOffers");
        Method createOffer = RetentionPromoController.class.getMethod(
                "createOffer", PromoOfferRequest.class, org.springframework.security.core.Authentication.class);
        Method toggleOffer = RetentionPromoController.class.getMethod(
                "toggleOffer", Long.class, RetentionPromoController.ToggleOfferRequest.class);

        for (Method m : List.of(insights, listOffers, createOffer, toggleOffer)) {
            PreAuthorize ann = m.getAnnotation(PreAuthorize.class);
            assertNotNull(ann);
            assertEquals("hasRole('OWNER')", ann.value());
        }
    }

    @Test
    void computesCustomerSegmentsRepeatRateAndInactiveCustomers() {
        Instant nowIst = ZonedDateTime.of(2026, 11, 21, 12, 0, 0, 0, IST).toInstant();
        Clock clock = Clock.fixed(nowIst, IST);

        User c1 = customer(1L, "Asha", "9000000001"); // NEW (1 order, 2 days ago)
        User c2 = customer(2L, "Babu", "9000000002"); // REPEAT (3 orders, Rs 900, 5 days ago)
        User c3 = customer(3L, "Chitra", "9000000003"); // HIGH_VALUE (4 orders, Rs 3200, 1 day ago)
        User c4 = customer(4L, "Deepak", "9000000004"); // INACTIVE (2 orders, 45 days ago)

        UserRepository users = proxy(UserRepository.class, (p, m, a) ->
                "findByRole".equals(m.getName()) ? List.of(c1, c2, c3, c4) : List.of());

        CustomerOrderRepository orders = proxy(CustomerOrderRepository.class, (p, m, a) -> {
            if ("summarizeCustomerOrderMetrics".equals(m.getName())) {
                return List.of(
                        proxy(CustomerOrderRepository.CustomerOrderMetrics.class, (p2, m2, a2) -> switch (m2.getName()) {
                            case "getCustomerId" -> 1L;
                            case "getTotalOrders" -> 1L;
                            case "getTotalSpend" -> new BigDecimal("250.00");
                            case "getFirstOrderAt" -> LocalDateTime.of(2026, 11, 19, 10, 0);
                            case "getLastOrderAt" -> LocalDateTime.of(2026, 11, 19, 10, 0);
                            default -> null;
                        }),
                        proxy(CustomerOrderRepository.CustomerOrderMetrics.class, (p2, m2, a2) -> switch (m2.getName()) {
                            case "getCustomerId" -> 2L;
                            case "getTotalOrders" -> 3L;
                            case "getTotalSpend" -> new BigDecimal("900.00");
                            case "getFirstOrderAt" -> LocalDateTime.of(2026, 10, 20, 10, 0);
                            case "getLastOrderAt" -> LocalDateTime.of(2026, 11, 16, 10, 0);
                            default -> null;
                        }),
                        proxy(CustomerOrderRepository.CustomerOrderMetrics.class, (p2, m2, a2) -> switch (m2.getName()) {
                            case "getCustomerId" -> 3L;
                            case "getTotalOrders" -> 4L;
                            case "getTotalSpend" -> new BigDecimal("3200.00");
                            case "getFirstOrderAt" -> LocalDateTime.of(2026, 10, 1, 10, 0);
                            case "getLastOrderAt" -> LocalDateTime.of(2026, 11, 20, 10, 0);
                            default -> null;
                        }),
                        proxy(CustomerOrderRepository.CustomerOrderMetrics.class, (p2, m2, a2) -> switch (m2.getName()) {
                            case "getCustomerId" -> 4L;
                            case "getTotalOrders" -> 2L;
                            case "getTotalSpend" -> new BigDecimal("600.00");
                            case "getFirstOrderAt" -> LocalDateTime.of(2026, 9, 1, 10, 0);
                            case "getLastOrderAt" -> LocalDateTime.of(2026, 10, 7, 10, 0);
                            default -> null;
                        }));
            }
            return List.of();
        });

        LoyaltyTransactionRepository loyalty = proxy(LoyaltyTransactionRepository.class, (p, m, a) -> List.of());

        RetentionService service = new RetentionService(users, orders, loyalty, clock);
        var dash = service.getInsights(
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 21),
                30, new BigDecimal("2000.00"), null, null, "spend", 0, 20);

        assertEquals(4L, dash.totalCustomers());
        assertEquals(1L, dash.newCustomersInPeriod());
        assertEquals(3L, dash.repeatCustomers());
        assertEquals(new BigDecimal("75.0"), dash.repeatPurchaseRate());
        assertEquals(1L, dash.inactiveCustomers());
        assertEquals(1L, dash.highValueCustomers());
        assertEquals(CustomerSegment.HIGH_VALUE, dash.customers().get(0).segment());
        assertEquals("Chitra", dash.customers().get(0).fullName());
    }

    @Test
    void validatesPromoCreationEnforcesLimitsConcurrencyLockAndPreventsDuplicates() {
        Instant nowIst = ZonedDateTime.of(2026, 11, 21, 12, 0, 0, 0, IST).toInstant();
        Clock clock = Clock.fixed(nowIst, IST);

        List<PromoOffer> offerStore = new ArrayList<>();
        List<PromoRedemption> redemptionStore = new ArrayList<>();
        AtomicBoolean lockUsed = new AtomicBoolean(false);

        PromoOfferRepository offerRepo = proxy(PromoOfferRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByCodeIgnoreCase" -> offerStore.stream()
                    .filter(o -> o.getCode().equalsIgnoreCase((String) a[0])).findFirst();
            case "findByCodeIgnoreCaseForUpdate" -> {
                lockUsed.set(true);
                yield offerStore.stream()
                        .filter(o -> o.getCode().equalsIgnoreCase((String) a[0])).findFirst();
            }
            case "findById" -> offerStore.stream()
                    .filter(o -> o.getId().equals(a[0])).findFirst();
            case "findAllByOrderByCreatedAtDescIdDesc" -> offerStore;
            case "save" -> {
                PromoOffer o = (PromoOffer) a[0];
                if (o.getId() == null) {
                    setField(o, "id", (long) (offerStore.size() + 1));
                    offerStore.add(o);
                }
                yield o;
            }
            default -> null;
        });

        PromoRedemptionRepository redRepo = proxy(PromoRedemptionRepository.class, (p, m, a) -> switch (m.getName()) {
            case "countByOfferId" -> redemptionStore.stream()
                    .filter(r -> r.getOfferId().equals(a[0])).count();
            case "countByOfferIdAndCustomerId" -> redemptionStore.stream()
                    .filter(r -> r.getOfferId().equals(a[0]) && r.getCustomerId().equals(a[1])).count();
            case "existsByOrderId" -> redemptionStore.stream()
                    .anyMatch(r -> r.getOrderId().equals(a[0]));
            case "save" -> {
                PromoRedemption r = (PromoRedemption) a[0];
                setField(r, "id", (long) (redemptionStore.size() + 1));
                redemptionStore.add(r);
                yield r;
            }
            default -> null;
        });

        User owner = customer(99L, "Owner", "9999999999");
        User c1 = customer(1L, "Anita", "9123456789");
        User c2 = customer(2L, "Ravi", "9123456780");
        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByPhone" -> "9999999999".equals(a[0]) ? Optional.of(owner)
                    : ("9123456789".equals(a[0]) ? Optional.of(c1) : Optional.empty());
            default -> Optional.empty();
        });

        PromoOfferService service = new PromoOfferService(offerRepo, redRepo, userRepo, clock);

        // Invalid percentage (> 100)
        assertThrows(BadRequestException.class, () -> service.createOffer(
                new PromoOfferRequest(
                        "Bad Offer", "BAD150", null, PromoDiscountType.PERCENTAGE,
                        new BigDecimal("150"), BigDecimal.ZERO, null,
                        LocalDateTime.of(2026, 11, 20, 0, 0),
                        LocalDateTime.of(2026, 11, 30, 23, 59),
                        10, 1, true),
                "9999999999"));

        // Valid percentage offer: 20% off, max Rs 60, minOrder Rs 200, maxTotalUses 2, perCustomer 1
        var created = service.createOffer(
                new PromoOfferRequest(
                        "Fresh 20", "fresh20", "20% off", PromoDiscountType.PERCENTAGE,
                        new BigDecimal("20"), new BigDecimal("200"), new BigDecimal("60"),
                        LocalDateTime.of(2026, 11, 20, 0, 0),
                        LocalDateTime.of(2026, 11, 30, 23, 59),
                        2, 1, true),
                "9999999999");
        assertEquals("FRESH20", created.code());

        // Min order check (150 < 200)
        assertThrows(BadRequestException.class, () -> service.validateAndLockForOrder(
                "FRESH20", c1.getId(), new BigDecimal("150.00"), BigDecimal.ZERO));

        // Valid order (400 -> 20% = 80 capped to max Rs 60)
        var applied = service.validateAndLockForOrder(
                "fresh20", c1.getId(), new BigDecimal("400.00"), BigDecimal.ZERO);
        assertTrue(lockUsed.get());
        assertEquals(new BigDecimal("60.00"), applied.discountAmount());
        service.recordRedemption(applied, c1.getId(), 501L);

        // Duplicate redemption for same order blocked
        assertThrows(DuplicateResourceException.class,
                () -> service.recordRedemption(applied, c1.getId(), 501L));

        // Per-customer limit (1) blocks c1 on second order
        assertThrows(BadRequestException.class, () -> service.validateAndLockForOrder(
                "FRESH20", c1.getId(), new BigDecimal("300.00"), BigDecimal.ZERO));

        // Second customer c2 succeeds (total uses now 2/2)
        var applied2 = service.validateAndLockForOrder(
                "FRESH20", c2.getId(), new BigDecimal("250.00"), new BigDecimal("220.00"));
        // Clamped so discount never exceeds (subtotal - loyaltyDiscount) = 30.00
        assertEquals(new BigDecimal("30.00"), applied2.discountAmount());
        service.recordRedemption(applied2, c2.getId(), 502L);

        // Expired offer test
        service.createOffer(
                new PromoOfferRequest(
                        "Expired", "OLD10", null, PromoDiscountType.FIXED,
                        new BigDecimal("10"), BigDecimal.ZERO, null,
                        LocalDateTime.of(2026, 11, 1, 0, 0),
                        LocalDateTime.of(2026, 11, 10, 23, 59),
                        null, 1, true),
                "9999999999");
        assertThrows(BadRequestException.class, () -> service.validateAndLockForOrder(
                "OLD10", c2.getId(), new BigDecimal("200.00"), BigDecimal.ZERO));
    }
}
