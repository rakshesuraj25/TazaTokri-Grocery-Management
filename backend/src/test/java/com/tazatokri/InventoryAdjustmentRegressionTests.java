package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
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

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InsufficientStockException;
import com.tazatokri.inventory.InventoryController.AdjustmentRequest;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.inventory.StockMovement;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

class InventoryAdjustmentRegressionTests {

    private static final String OWNER_PHONE = "9999999999";

    private record Harness(
            InventoryService service,
            List<StockMovement> ledger,
            AtomicInteger lockAcquireCount) {}

    private Harness createHarness(Vegetable veg, BigDecimal initialStock, RuntimeException saveFailure) {
        List<StockMovement> ledger = new ArrayList<>();
        if (initialStock != null && initialStock.signum() != 0) {
            ledger.add(new StockMovement(veg, MovementType.PURCHASE, initialStock, "PURCHASE", 1L, "Initial", 1L));
        }
        AtomicInteger lockAcquireCount = new AtomicInteger(0);
        ReentrantLock rowLock = new ReentrantLock();

        VegetableRepository vegRepo = (VegetableRepository) Proxy.newProxyInstance(
                VegetableRepository.class.getClassLoader(),
                new Class<?>[] { VegetableRepository.class },
                (proxy, method, args) -> {
                    if ("findByIdForUpdate".equals(method.getName())) {
                        rowLock.lock();
                        lockAcquireCount.incrementAndGet();
                        Long id = (Long) args[0];
                        return id.equals(veg.getId()) ? Optional.of(veg) : Optional.empty();
                    }
                    throw new UnsupportedOperationException("VegetableRepository." + method.getName());
                });

        StockMovementRepository moveRepo = (StockMovementRepository) Proxy.newProxyInstance(
                StockMovementRepository.class.getClassLoader(),
                new Class<?>[] { StockMovementRepository.class },
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "currentStock":
                            synchronized (ledger) {
                                return ledger.stream()
                                        .map(StockMovement::getQuantity)
                                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                            }
                        case "save":
                            try {
                                if (saveFailure != null) {
                                    throw saveFailure;
                                }
                                StockMovement m = (StockMovement) args[0];
                                synchronized (ledger) {
                                    ledger.add(m);
                                }
                                return m;
                            } finally {
                                if (rowLock.isHeldByCurrentThread()) {
                                    rowLock.unlock();
                                }
                            }
                        default:
                            throw new UnsupportedOperationException("StockMovementRepository." + method.getName());
                    }
                });

        User owner = new User();
        owner.setId(1L);
        owner.setPhone(OWNER_PHONE);
        owner.setFullName("Owner");

        UserRepository userRepo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (proxy, method, args) -> {
                    if ("findByPhone".equals(method.getName())) {
                        return OWNER_PHONE.equals(args[0]) ? Optional.of(owner) : Optional.empty();
                    }
                    throw new UnsupportedOperationException("UserRepository." + method.getName());
                });

        InventoryService service = new InventoryService(moveRepo, vegRepo, userRepo) {
            @Override
            public StockMovement record(Long vegetableId, MovementType type, BigDecimal quantity,
                    String note, String refType, Long refId, String actorPhone) {
                try {
                    return super.record(vegetableId, type, quantity, note, refType, refId, actorPhone);
                } finally {
                    if (rowLock.isHeldByCurrentThread()) {
                        rowLock.unlock();
                    }
                }
            }
        };
        return new Harness(service, ledger, lockAcquireCount);
    }

    private Vegetable veg(long id, String name, UnitType unit) {
        Vegetable v = new Vegetable();
        v.setId(id);
        v.setNameEn(name);
        v.setBaseUnit(unit);
        v.setActive(true);
        return v;
    }

    @Test
    void addsTenKgAndCreatesSingleLedgerMovement() {
        Harness h = createHarness(veg(5L, "Tomato", UnitType.KG), BigDecimal.ZERO, null);
        StockMovement m = h.service().record(
                5L, MovementType.ADJUSTMENT, new BigDecimal("10"), "Updated", null, null, OWNER_PHONE);

        assertEquals(1, h.lockAcquireCount().get());
        assertEquals(1, h.ledger().size());
        assertEquals(MovementType.ADJUSTMENT, m.getType());
        assertEquals(new BigDecimal("10"), m.getQuantity());
        assertEquals("Updated", m.getNote());
        assertEquals(new BigDecimal("10"), h.service().currentStock(5L));
    }

    @Test
    void addsTenBunchAndCreatesSingleLedgerMovement() {
        Harness h = createHarness(veg(6L, "Spinach", UnitType.BUNCH), BigDecimal.ZERO, null);
        StockMovement m = h.service().record(
                6L, MovementType.ADJUSTMENT, new BigDecimal("10"), "Morning restock", null, null, OWNER_PHONE);

        assertEquals(1, h.lockAcquireCount().get());
        assertEquals(1, h.ledger().size());
        assertEquals(UnitType.BUNCH, m.getVegetable().getBaseUnit());
        assertEquals(new BigDecimal("10"), h.service().currentStock(6L));
    }

    @Test
    void reducesStockWhenSufficientBalanceExists() {
        Harness h = createHarness(veg(5L, "Tomato", UnitType.KG), new BigDecimal("10.000"), null);
        StockMovement m = h.service().record(
                5L, MovementType.ADJUSTMENT, new BigDecimal("-4.000"), "Shrinkage", null, null, OWNER_PHONE);

        assertEquals(new BigDecimal("-4.000"), m.getQuantity());
        assertEquals(2, h.ledger().size()); // initial purchase + 1 adjustment
        assertEquals(new BigDecimal("6.000"), h.service().currentStock(5L));
    }

    @Test
    void rejectsAdjustmentThatWouldResultInNegativeStock() {
        Harness h = createHarness(veg(5L, "Tomato", UnitType.KG), new BigDecimal("5.000"), null);

        assertThrows(InsufficientStockException.class, () -> h.service().record(
                5L, MovementType.ADJUSTMENT, new BigDecimal("-6.000"), "Damaged", null, null, OWNER_PHONE));

        assertEquals(1, h.ledger().size()); // only initial purchase remains
        assertEquals(new BigDecimal("5.000"), h.service().currentStock(5L));
    }

    @Test
    void rejectsZeroOrNullQuantity() {
        Harness h = createHarness(veg(5L, "Tomato", UnitType.KG), new BigDecimal("5.000"), null);

        assertThrows(BadRequestException.class, () -> h.service().record(
                5L, MovementType.ADJUSTMENT, BigDecimal.ZERO, "Zero adjust", null, null, OWNER_PHONE));

        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(new AdjustmentRequest(5L, null, "Updated")).isEmpty());
        assertEquals(1, h.ledger().size());
    }

    @Test
    void rejectsMissingOrBlankReason() {
        Harness h = createHarness(veg(5L, "Tomato", UnitType.KG), new BigDecimal("5.000"), null);

        assertThrows(BadRequestException.class, () -> h.service().record(
                5L, MovementType.ADJUSTMENT, new BigDecimal("2"), null, null, null, OWNER_PHONE));
        assertThrows(BadRequestException.class, () -> h.service().record(
                5L, MovementType.ADJUSTMENT, new BigDecimal("2"), "   ", null, null, OWNER_PHONE));

        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(new AdjustmentRequest(5L, new BigDecimal("2"), "   ")).isEmpty());
        assertEquals(1, h.ledger().size());
    }

    @Test
    void concurrentAdjustmentsPreserveStockIntegrityWithoutNegativeBalance() throws Exception {
        Harness h = createHarness(veg(5L, "Tomato", UnitType.KG), new BigDecimal("10.000"), null);
        int threads = 10;
        CountDownLatch startGate = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        AtomicInteger succeeded = new AtomicInteger(0);
        AtomicInteger rejected = new AtomicInteger(0);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            final int idx = i;
            futures.add(pool.submit(() -> {
                startGate.await();
                try {
                    h.service().record(5L, MovementType.ADJUSTMENT, new BigDecimal("-2.000"),
                            "Concurrent #" + idx, null, null, OWNER_PHONE);
                    succeeded.incrementAndGet();
                } catch (InsufficientStockException ex) {
                    rejected.incrementAndGet();
                }
                return null;
            }));
        }

        startGate.countDown();
        for (Future<?> f : futures) {
            f.get();
        }
        pool.shutdown();

        assertEquals(5, succeeded.get());
        assertEquals(5, rejected.get());
        assertEquals(0, h.service().currentStock(5L).compareTo(BigDecimal.ZERO));
        assertEquals(6, h.ledger().size()); // 1 initial purchase + 5 successful adjustments
    }

    @Test
    void propagatesFailureAndPreservesTransactionalBoundaryWhenLedgerSaveFails() throws Exception {
        Method recordMethod = InventoryService.class.getMethod(
                "record", Long.class, MovementType.class, BigDecimal.class,
                String.class, String.class, Long.class, String.class);
        Transactional tx = recordMethod.getAnnotation(Transactional.class);
        assertNotNull(tx, "InventoryService.record must remain @Transactional");
        assertFalse(tx.readOnly());

        Harness h = createHarness(veg(5L, "Tomato", UnitType.KG), new BigDecimal("10.000"),
                new RuntimeException("Simulated ledger insert failure"));

        assertThrows(RuntimeException.class, () -> h.service().record(
                5L, MovementType.ADJUSTMENT, new BigDecimal("10.000"), "Updated", null, null, OWNER_PHONE));
        assertEquals(1, h.ledger().size());
        assertEquals(new BigDecimal("10.000"), h.service().currentStock(5L));
    }

    @Test
    void vegetableRepositoryUsesTiDbCompatibleNativeForUpdateWithoutAliasLock() throws Exception {
        Method m = VegetableRepository.class.getMethod("findByIdForUpdate", Long.class);
        assertNull(m.getAnnotation(Lock.class),
                "findByIdForUpdate must not use @Lock(PESSIMISTIC_WRITE) which emits FOR UPDATE OF <alias> on TiDB");

        Query query = m.getAnnotation(Query.class);
        assertNotNull(query);
        assertTrue(query.nativeQuery(), "findByIdForUpdate must use a native SQL query");
        assertEquals("SELECT * FROM vegetables WHERE id = :id FOR UPDATE", query.value());
        assertFalse(query.value().toUpperCase().contains("FOR UPDATE OF"),
                "Locking SQL must not contain TiDB-incompatible FOR UPDATE OF clause");
    }
}
