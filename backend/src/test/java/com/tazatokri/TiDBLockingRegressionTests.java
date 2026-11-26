package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.loyalty.LoyaltyTransactionRepository;
import com.tazatokri.loyalty.LoyaltyService;
import com.tazatokri.loyalty.LoyaltySettings;
import com.tazatokri.loyalty.LoyaltySettingsRepository;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.payment.Payment;
import com.tazatokri.payment.PaymentKind;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.payment.SettlementResponse;
import com.tazatokri.payment.PaymentStatus;
import com.tazatokri.purchase.PurchaseService;
import com.tazatokri.purchase.SupplierRepository;
import com.tazatokri.purchase.SupplierService;
import com.tazatokri.retention.PromoDiscountType;
import com.tazatokri.retention.PromoOffer;
import com.tazatokri.retention.PromoOfferRepository;
import com.tazatokri.retention.PromoOfferService;
import com.tazatokri.retention.PromoRedemptionRepository;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

/**
 * Phase 2 TiDB Locking Regression Tests.
 *
 * <p>Note on scope:
 * <ul>
 *   <li>Reflection tests verify that all 8 locking repository methods emit TiDB-compatible
 *       native {@code SELECT ... FOR UPDATE} SQL without Hibernate 7 {@code FOR UPDATE OF <alias>}.</li>
 *   <li>Concurrency tests use proxy/mocked repositories with explicit {@link ReentrantLock}
 *       serialization to verify service-level concurrency invariants (distinct from real TiDB/InnoDB
 *       row-level locking tests).</li>
 * </ul>
 */
class TiDBLockingRegressionTests {

    private void assertNativeForUpdate(Class<?> repo, String methodName, Class<?>... paramTypes) throws Exception {
        Method m = repo.getMethod(methodName, paramTypes);
        assertNull(m.getAnnotation(Lock.class),
                repo.getSimpleName() + "." + methodName + " must not use @Lock");
        Query q = m.getAnnotation(Query.class);
        assertNotNull(q, repo.getSimpleName() + "." + methodName + " must declare @Query");
        assertTrue(q.nativeQuery(), repo.getSimpleName() + "." + methodName + " must use nativeQuery = true");
        String normalized = q.value().replaceAll("\\s+", " ").trim().toUpperCase();
        assertTrue(normalized.endsWith("FOR UPDATE"),
                repo.getSimpleName() + "." + methodName + " must end with FOR UPDATE, got: " + normalized);
        assertFalse(normalized.contains("FOR UPDATE OF"),
                repo.getSimpleName() + "." + methodName + " must not contain FOR UPDATE OF, got: " + normalized);
    }

    @Test
    void allLockingRepositoriesEmitTiDbCompatibleNativeForUpdateSql() throws Exception {
        assertNativeForUpdate(VegetableRepository.class, "findByIdForUpdate", Long.class);
        assertNativeForUpdate(CustomerOrderRepository.class, "findByIdForUpdate", Long.class);
        assertNativeForUpdate(PaymentRepository.class, "lockUnsettledCash", Long.class);
        assertNativeForUpdate(PaymentRepository.class, "findByIdForUpdate", Long.class);
        assertNativeForUpdate(SupplierRepository.class, "findByIdForUpdate", Long.class);
        assertNativeForUpdate(PromoOfferRepository.class, "findByCodeIgnoreCaseForUpdate", String.class);
        assertNativeForUpdate(PromoOfferRepository.class, "findByIdForUpdate", Long.class);
        assertNativeForUpdate(UserRepository.class, "findByIdForUpdate", Long.class);

        Query lockUnsettled = PaymentRepository.class.getMethod("lockUnsettledCash", Long.class)
                .getAnnotation(Query.class);
        String cashSql = lockUnsettled.value().replaceAll("\\s+", " ").trim().toUpperCase();
        assertTrue(cashSql.contains("ORDER BY ID FOR UPDATE"),
                "lockUnsettledCash must preserve deterministic ORDER BY id before FOR UPDATE");

        Query promoByCode = PromoOfferRepository.class.getMethod("findByCodeIgnoreCaseForUpdate", String.class)
                .getAnnotation(Query.class);
        String promoSql = promoByCode.value().replaceAll("\\s+", " ").trim().toUpperCase();
        assertTrue(promoSql.contains("UPPER(CODE) = UPPER(:CODE)"),
                "findByCodeIgnoreCaseForUpdate must preserve case-insensitive code lookup");
    }

    @Test
    void transactionalBoundariesRemainIntactAcrossServices() throws Exception {
        assertNotNull(PaymentService.class.getMethod("settle", Long.class, BigDecimal.class, String.class)
                .getAnnotation(Transactional.class));
        assertNotNull(PurchaseService.class.getMethod("cancel", Long.class, String.class, String.class)
                .getAnnotation(Transactional.class));
        assertNotNull(PromoOfferService.class.getMethod("releaseRedemptionForCancelledOrder", Long.class)
                .getAnnotation(Transactional.class));
        Method recordPayment = java.util.Arrays.stream(SupplierService.class.getMethods())
                .filter(m -> m.getName().equals("recordPayment"))
                .findFirst()
                .orElseThrow();
        assertNotNull(recordPayment.getAnnotation(Transactional.class));
    }

    @Test
    void concurrentPaymentSettlementPreventsDoubleSettlement() throws Exception {
        Payment p = new Payment();
        p.setId(10L);
        p.setCollectedBy(7L);
        p.setMethod(PaymentMethod.CASH);
        p.setKind(PaymentKind.COLLECTION);
        p.setStatus(PaymentStatus.SUCCESS);
        p.setAmount(new BigDecimal("250.00"));
        p.setSettledAt(null);

        ReentrantLock lock = new ReentrantLock();
        PaymentRepository payRepo = (PaymentRepository) Proxy.newProxyInstance(
                PaymentRepository.class.getClassLoader(),
                new Class<?>[] { PaymentRepository.class },
                (proxy, method, args) -> {
                    if ("lockUnsettledCash".equals(method.getName())) {
                        lock.lock();
                        return p.getSettledAt() == null ? List.of(p) : List.of();
                    }
                    throw new UnsupportedOperationException("PaymentRepository." + method.getName());
                });

        User owner = new User();
        owner.setId(1L);
        owner.setPhone("9999999999");
        UserRepository userRepo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (proxy, method, args) -> "findByPhone".equals(method.getName())
                        ? Optional.of(owner) : Optional.empty());

        PaymentService service = new PaymentService(payRepo, userRepo) {
            @Override
            public SettlementResponse settle(Long deliveryUserId, BigDecimal received, String ownerPhone) {
                try {
                    return super.settle(deliveryUserId, received, ownerPhone);
                } finally {
                    if (lock.isHeldByCurrentThread()) {
                        lock.unlock();
                    }
                }
            }
        };

        int threads = 4;
        CountDownLatch gate = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        AtomicInteger settled = new AtomicInteger(0);
        AtomicInteger rejected = new AtomicInteger(0);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                gate.await();
                try {
                    service.settle(7L, new BigDecimal("250.00"), "9999999999");
                    settled.incrementAndGet();
                } catch (BadRequestException ex) {
                    rejected.incrementAndGet();
                }
                return null;
            }));
        }
        gate.countDown();
        for (Future<?> f : futures) f.get();
        pool.shutdown();

        assertEquals(1, settled.get());
        assertEquals(threads - 1, rejected.get());
        assertNotNull(p.getSettledAt());
    }

    @Test
    void concurrentLoyaltyRedemptionEnforcesPointBalance() throws Exception {
        User customer = new User();
        customer.setId(50L);
        AtomicInteger balance = new AtomicInteger(100);
        ReentrantLock lock = new ReentrantLock();

        UserRepository userRepo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (proxy, method, args) -> {
                    if ("findByIdForUpdate".equals(method.getName())) {
                        lock.lock();
                        return Optional.of(customer);
                    }
                    throw new UnsupportedOperationException("UserRepository." + method.getName());
                });

        LoyaltyTransactionRepository txRepo = (LoyaltyTransactionRepository) Proxy.newProxyInstance(
                LoyaltyTransactionRepository.class.getClassLoader(),
                new Class<?>[] { LoyaltyTransactionRepository.class },
                (proxy, method, args) -> {
                    if ("sumActivePointsForCustomer".equals(method.getName())) {
                        return (long) balance.get();
                    }
                    throw new UnsupportedOperationException("LoyaltyPointTransactionRepository." + method.getName());
                });

        LoyaltySettings settings = new LoyaltySettings();
        settings.setEnabled(true);
        settings.setMinRedeemPoints(10);
        settings.setMaxRedeemPointsPerOrder(100);
        settings.setRupeesPerPoint(new BigDecimal("1.00"));
        LoyaltySettingsRepository settingsRepo = (LoyaltySettingsRepository) Proxy.newProxyInstance(
                LoyaltySettingsRepository.class.getClassLoader(),
                new Class<?>[] { LoyaltySettingsRepository.class },
                (proxy, method, args) -> "findById".equals(method.getName())
                        ? Optional.of(settings) : List.of(settings));

        LoyaltyService loyaltyService = new LoyaltyService(settingsRepo, txRepo, userRepo) {
            @Override
            public RedemptionCalculation validateAndLockForRedemption(
                    Long customerId, int requestedPoints, BigDecimal itemsSubtotal) {
                try {
                    RedemptionCalculation calc = super.validateAndLockForRedemption(
                            customerId, requestedPoints, itemsSubtotal);
                    balance.addAndGet(-calc.pointsRedeemed());
                    return calc;
                } finally {
                    if (lock.isHeldByCurrentThread()) {
                        lock.unlock();
                    }
                }
            }
        };

        int threads = 5;
        CountDownLatch gate = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        AtomicInteger ok = new AtomicInteger(0);
        AtomicInteger rejected = new AtomicInteger(0);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                gate.await();
                try {
                    loyaltyService.validateAndLockForRedemption(50L, 60, new BigDecimal("200.00"));
                    ok.incrementAndGet();
                } catch (BadRequestException ex) {
                    rejected.incrementAndGet();
                }
                return null;
            }));
        }
        gate.countDown();
        for (Future<?> f : futures) f.get();
        pool.shutdown();

        assertEquals(1, ok.get());
        assertEquals(threads - 1, rejected.get());
        assertEquals(40, balance.get());
    }

    @Test
    void concurrentPromoValidationEnforcesMaxTotalUses() throws Exception {
        PromoOffer offer = new PromoOffer();
        offer.setId(9L);
        offer.setCode("FRESH10");
        offer.setDiscountType(PromoDiscountType.FIXED);
        offer.setDiscountValue(new BigDecimal("20.00"));
        offer.setMinOrderAmount(new BigDecimal("100.00"));
        offer.setMaxTotalUses(1);
        offer.setEnabled(true);
        offer.setStartsAt(LocalDateTime.now().minusDays(1));
        offer.setExpiresAt(LocalDateTime.now().plusDays(5));

        AtomicInteger usedCount = new AtomicInteger(0);
        ReentrantLock lock = new ReentrantLock();

        PromoOfferRepository offerRepo = (PromoOfferRepository) Proxy.newProxyInstance(
                PromoOfferRepository.class.getClassLoader(),
                new Class<?>[] { PromoOfferRepository.class },
                (proxy, method, args) -> {
                    if ("findByCodeIgnoreCaseForUpdate".equals(method.getName())) {
                        lock.lock();
                        return Optional.of(offer);
                    }
                    throw new UnsupportedOperationException("PromoOfferRepository." + method.getName());
                });

        PromoRedemptionRepository redemptionRepo = (PromoRedemptionRepository) Proxy.newProxyInstance(
                PromoRedemptionRepository.class.getClassLoader(),
                new Class<?>[] { PromoRedemptionRepository.class },
                (proxy, method, args) -> {
                    if ("countByOfferId".equals(method.getName())) {
                        return (long) usedCount.get();
                    }
                    if ("countByOfferIdAndCustomerId".equals(method.getName())) {
                        return 0L;
                    }
                    throw new UnsupportedOperationException("PromoRedemptionRepository." + method.getName());
                });

        PromoOfferService promoService = new PromoOfferService(offerRepo, redemptionRepo, null) {
            @Override
            public AppliedPromo validateAndLockForOrder(String rawCode, Long customerId,
                    BigDecimal subtotal, BigDecimal loyaltyDiscount) {
                try {
                    AppliedPromo applied = super.validateAndLockForOrder(
                            rawCode, customerId, subtotal, loyaltyDiscount);
                    usedCount.incrementAndGet();
                    return applied;
                } finally {
                    if (lock.isHeldByCurrentThread()) {
                        lock.unlock();
                    }
                }
            }
        };

        int threads = 5;
        CountDownLatch gate = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        AtomicInteger ok = new AtomicInteger(0);
        AtomicInteger rejected = new AtomicInteger(0);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            final long cid = 100L + i;
            futures.add(pool.submit(() -> {
                gate.await();
                try {
                    promoService.validateAndLockForOrder("fresh10", cid,
                            new BigDecimal("200.00"), BigDecimal.ZERO);
                    ok.incrementAndGet();
                } catch (BadRequestException ex) {
                    rejected.incrementAndGet();
                }
                return null;
            }));
        }
        gate.countDown();
        for (Future<?> f : futures) f.get();
        pool.shutdown();

        assertEquals(1, ok.get());
        assertEquals(threads - 1, rejected.get());
        assertEquals(1, usedCount.get());
    }
}
