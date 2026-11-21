package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.inventory.StockMovement;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.purchase.Purchase;
import com.tazatokri.purchase.PurchaseItemRequest;
import com.tazatokri.purchase.PurchasePaymentStatus;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.purchase.PurchaseRequest;
import com.tazatokri.purchase.PurchaseResponse;
import com.tazatokri.purchase.PurchaseService;
import com.tazatokri.purchase.PurchaseStatus;
import com.tazatokri.purchase.Supplier;
import com.tazatokri.purchase.SupplierController;
import com.tazatokri.purchase.SupplierPayment;
import com.tazatokri.purchase.SupplierPaymentMethod;
import com.tazatokri.purchase.SupplierPaymentRepository;
import com.tazatokri.purchase.SupplierRepository;
import com.tazatokri.purchase.SupplierService;
import com.tazatokri.purchase.SupplierType;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class SupplierPurchaseTests {

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    private static class InMemoryHarness {
        final AtomicLong supplierSeq = new AtomicLong(1);
        final AtomicLong purchaseSeq = new AtomicLong(1);
        final AtomicLong paymentSeq = new AtomicLong(1);
        final AtomicLong movementSeq = new AtomicLong(1);

        final Map<Long, Supplier> supplierStore = new ConcurrentHashMap<>();
        final Map<Long, Purchase> purchaseStore = new ConcurrentHashMap<>();
        final Map<Long, SupplierPayment> paymentStore = new ConcurrentHashMap<>();
        final Map<Long, Vegetable> vegStore = new ConcurrentHashMap<>();
        final List<StockMovement> movements = java.util.Collections.synchronizedList(new ArrayList<>());
        final ReentrantLock supplierRowLock = new ReentrantLock();
        final AtomicInteger lockAcquisitions = new AtomicInteger(0);

        final User owner;
        final SupplierRepository supplierRepo;
        final PurchaseRepository purchaseRepo;
        final SupplierPaymentRepository paymentRepo;
        final VegetableRepository vegRepo;
        final UserRepository userRepo;
        final StockMovementRepository movementRepo;
        final InventoryService inventoryService;
        final PurchaseService purchaseService;
        final SupplierService supplierService;

        InMemoryHarness() {
            owner = new User();
            owner.setId(1L);
            owner.setFullName("Owner");
            owner.setPhone("9876543210");
            owner.setRoles(java.util.Set.of(Role.OWNER));

            Vegetable tomato = new Vegetable();
            tomato.setId(10L);
            tomato.setNameEn("Tomato");
            tomato.setBaseUnit(UnitType.KG);
            tomato.setActive(true);
            vegStore.put(10L, tomato);

            Vegetable onion = new Vegetable();
            onion.setId(11L);
            onion.setNameEn("Onion");
            onion.setBaseUnit(UnitType.KG);
            onion.setActive(true);
            vegStore.put(11L, onion);

            supplierRepo = proxy(SupplierRepository.class, (p, m, a) -> {
                switch (m.getName()) {
                    case "save" -> {
                        Supplier s = (Supplier) a[0];
                        if (s.getId() == null) s.setId(supplierSeq.getAndIncrement());
                        supplierStore.put(s.getId(), s);
                        return s;
                    }
                    case "findById" -> Optional.ofNullable(supplierStore.get((Long) a[0]));
                    case "findByIdForUpdate" -> {
                        lockAcquisitions.incrementAndGet();
                        return Optional.ofNullable(supplierStore.get((Long) a[0]));
                    }
                    case "findAll" -> new ArrayList<>(supplierStore.values());
                    case "existsById" -> supplierStore.containsKey((Long) a[0]);
                    case "existsByNameIgnoreCase" -> {
                        String n = (String) a[0];
                        return supplierStore.values().stream().anyMatch(s -> s.getName().equalsIgnoreCase(n));
                    }
                    case "existsByNameIgnoreCaseAndIdNot" -> {
                        String n = (String) a[0];
                        Long id = (Long) a[1];
                        return supplierStore.values().stream()
                                .anyMatch(s -> !s.getId().equals(id) && s.getName().equalsIgnoreCase(n));
                    }
                    default -> throw new UnsupportedOperationException("SupplierRepository." + m.getName());
                }
                return null;
            });

            // Re-implement findById returning Optional cleanly:
            SupplierRepository sRepo = proxy(SupplierRepository.class, (p, m, a) -> switch (m.getName()) {
                case "save" -> {
                    Supplier s = (Supplier) a[0];
                    if (s.getId() == null) s.setId(supplierSeq.getAndIncrement());
                    supplierStore.put(s.getId(), s);
                    yield s;
                }
                case "findById" -> Optional.ofNullable(supplierStore.get((Long) a[0]));
                case "findByIdForUpdate" -> {
                    lockAcquisitions.incrementAndGet();
                    yield Optional.ofNullable(supplierStore.get((Long) a[0]));
                }
                case "findAll" -> new ArrayList<>(supplierStore.values());
                case "existsById" -> supplierStore.containsKey((Long) a[0]);
                case "existsByNameIgnoreCase" -> {
                    String n = (String) a[0];
                    yield supplierStore.values().stream().anyMatch(s -> s.getName().equalsIgnoreCase(n));
                }
                case "existsByNameIgnoreCaseAndIdNot" -> {
                    String n = (String) a[0];
                    Long id = (Long) a[1];
                    yield supplierStore.values().stream()
                            .anyMatch(s -> !s.getId().equals(id) && s.getName().equalsIgnoreCase(n));
                }
                default -> throw new UnsupportedOperationException("SupplierRepository." + m.getName());
            });

            purchaseRepo = proxy(PurchaseRepository.class, (p, m, a) -> switch (m.getName()) {
                case "save" -> {
                    Purchase pur = (Purchase) a[0];
                    if (pur.getId() == null) pur.setId(purchaseSeq.getAndIncrement());
                    purchaseStore.put(pur.getId(), pur);
                    yield pur;
                }
                case "findWithDetailsById" -> Optional.ofNullable(purchaseStore.get((Long) a[0]));
                case "findByIdempotencyKey" -> {
                    String key = (String) a[0];
                    yield purchaseStore.values().stream()
                            .filter(pur -> key.equals(pur.getIdempotencyKey()))
                            .findFirst();
                }
                case "findBySupplierIdOrderByPurchaseDateDescIdDesc" -> {
                    Long sid = (Long) a[0];
                    yield purchaseStore.values().stream()
                            .filter(pur -> pur.getSupplier().getId().equals(sid))
                            .sorted((x, y) -> Long.compare(y.getId(), x.getId()))
                            .toList();
                }
                case "sumCompletedBySupplier" -> {
                    Long sid = (Long) a[0];
                    yield purchaseStore.values().stream()
                            .filter(pur -> pur.getSupplier().getId().equals(sid)
                                    && pur.getStatus() == PurchaseStatus.COMPLETED)
                            .map(Purchase::getTotalCost)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                }
                case "summarizeAllSupplierPurchases" -> {
                    Map<Long, List<Purchase>> bySup = new ConcurrentHashMap<>();
                    for (Purchase pur : purchaseStore.values()) {
                        if (pur.getStatus() == PurchaseStatus.COMPLETED) {
                            bySup.computeIfAbsent(pur.getSupplier().getId(), k -> new ArrayList<>()).add(pur);
                        }
                    }
                    yield bySup.entrySet().stream()
                            .map(e -> new PurchaseRepository.SupplierPurchaseProjection() {
                                @Override public Long getSupplierId() { return e.getKey(); }
                                @Override public long getPurchaseCount() { return e.getValue().size(); }
                                @Override public BigDecimal getTotalPurchases() {
                                    return e.getValue().stream().map(Purchase::getTotalCost)
                                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                                }
                                @Override public LocalDate getLastPurchaseDate() {
                                    return e.getValue().stream().map(Purchase::getPurchaseDate)
                                            .max(LocalDate::compareTo).orElse(null);
                                }
                            }).toList();
                }
                default -> throw new UnsupportedOperationException("PurchaseRepository." + m.getName());
            });

            paymentRepo = proxy(SupplierPaymentRepository.class, (p, m, a) -> switch (m.getName()) {
                case "save" -> {
                    SupplierPayment sp = (SupplierPayment) a[0];
                    if (sp.getId() == null) sp.setId(paymentSeq.getAndIncrement());
                    paymentStore.put(sp.getId(), sp);
                    yield sp;
                }
                case "findByIdempotencyKey" -> {
                    String key = (String) a[0];
                    yield paymentStore.values().stream()
                            .filter(sp -> key.equals(sp.getIdempotencyKey()))
                            .findFirst();
                }
                case "findBySupplierIdOrderByPaymentDateDescIdDesc" -> {
                    Long sid = (Long) a[0];
                    yield paymentStore.values().stream()
                            .filter(sp -> sp.getSupplier().getId().equals(sid))
                            .sorted((x, y) -> Long.compare(y.getId(), x.getId()))
                            .toList();
                }
                case "sumPaidBySupplier" -> {
                    Long sid = (Long) a[0];
                    yield paymentStore.values().stream()
                            .filter(sp -> sp.getSupplier().getId().equals(sid))
                            .map(SupplierPayment::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                }
                case "sumPaidByPurchase" -> {
                    Long pid = (Long) a[0];
                    yield paymentStore.values().stream()
                            .filter(sp -> sp.getPurchase() != null && sp.getPurchase().getId().equals(pid))
                            .map(SupplierPayment::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                }
                case "summarizeAllSupplierPayments" -> {
                    Map<Long, BigDecimal> sums = new ConcurrentHashMap<>();
                    for (SupplierPayment sp : paymentStore.values()) {
                        sums.merge(sp.getSupplier().getId(), sp.getAmount(), BigDecimal::add);
                    }
                    yield sums.entrySet().stream()
                            .map(e -> new SupplierPaymentRepository.SupplierPaidProjection() {
                                @Override public Long getSupplierId() { return e.getKey(); }
                                @Override public BigDecimal getTotalPaid() { return e.getValue(); }
                            }).toList();
                }
                default -> throw new UnsupportedOperationException("SupplierPaymentRepository." + m.getName());
            });

            vegRepo = proxy(VegetableRepository.class, (p, m, a) -> switch (m.getName()) {
                case "findById", "findByIdForUpdate" -> Optional.ofNullable(vegStore.get((Long) a[0]));
                default -> throw new UnsupportedOperationException("VegetableRepository." + m.getName());
            });

            userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
                case "findByPhone" -> owner.getPhone().equals(a[0]) ? Optional.of(owner) : Optional.empty();
                default -> throw new UnsupportedOperationException("UserRepository." + m.getName());
            });

            movementRepo = proxy(StockMovementRepository.class, (p, m, a) -> switch (m.getName()) {
                case "save" -> {
                    StockMovement sm = (StockMovement) a[0];
                    movements.add(sm);
                    yield sm;
                }
                case "currentStock" -> {
                    Long vid = (Long) a[0];
                    synchronized (movements) {
                        yield movements.stream()
                                .filter(sm -> sm.getVegetable().getId().equals(vid))
                                .map(StockMovement::getQuantity)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                    }
                }
                default -> throw new UnsupportedOperationException("StockMovementRepository." + m.getName());
            });

            this.inventoryService = new InventoryService(movementRepo, vegRepo, userRepo);
            this.purchaseService = new PurchaseService(
                    purchaseRepo, sRepo, paymentRepo, vegRepo, userRepo, inventoryService);
            this.supplierService = new SupplierService(sRepo, purchaseRepo, paymentRepo, userRepo);
        }
    }

    @Test
    void supplierCreationUpdateStatusAndOwnerAuthorization() throws Exception {
        InMemoryHarness h = new InMemoryHarness();

        Supplier created = h.supplierService.create(new SupplierService.SupplierCreateUpdateRequest(
                "  ganesh   mandi ", SupplierType.WHOLESALE_MARKET, "9876543211",
                "Market Yard Pune", "Morning delivery", true));
        assertNotNull(created.getId());
        assertEquals("ganesh mandi", created.getName());
        assertEquals("Market Yard Pune", created.getAddress());
        assertTrue(created.isActive());

        Supplier updated = h.supplierService.update(created.getId(),
                new SupplierService.SupplierCreateUpdateRequest(
                        "Ganesh Mandi", SupplierType.WHOLESALE_MARKET, "9876543212",
                        "Gate 2, Market Yard", "Updated notes", true));
        assertEquals("9876543212", updated.getPhone());
        assertEquals("Gate 2, Market Yard", updated.getAddress());

        Supplier deactivated = h.supplierService.updateStatus(created.getId(), false);
        assertFalse(deactivated.isActive());

        // Verify OWNER-only PreAuthorize on supplier management & payment endpoints
        Method createMethod = SupplierController.class.getMethod("create", SupplierController.SupplierRequest.class);
        Method payMethod = SupplierController.class.getMethod("recordPayment", Long.class,
                SupplierController.RecordSupplierPaymentRequest.class,
                org.springframework.security.core.Authentication.class);
        assertEquals("hasRole('OWNER')", createMethod.getAnnotation(PreAuthorize.class).value());
        assertEquals("hasRole('OWNER')", payMethod.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void multiItemPurchaseStockUpdateAndDuplicateIdempotency() {
        InMemoryHarness h = new InMemoryHarness();
        Supplier s = h.supplierService.create(new SupplierService.SupplierCreateUpdateRequest(
                "Kisan Farm", SupplierType.FARMER, "9876500001", "Nashik", null, true));

        PurchaseRequest req = new PurchaseRequest(
                s.getId(),
                LocalDate.now(),
                new BigDecimal("100.00"),
                "INV-2026-01",
                "pur-key-1",
                "Morning lot",
                List.of(
                        new PurchaseItemRequest(10L, new BigDecimal("20.000"), new BigDecimal("30.00")),
                        new PurchaseItemRequest(11L, new BigDecimal("10.000"), new BigDecimal("40.00"))));

        PurchaseResponse res = h.purchaseService.create(req, h.owner.getPhone());
        assertEquals(new BigDecimal("1100.00"), res.totalCost());
        assertEquals("INV-2026-01", res.invoiceNumber());
        assertEquals(PurchaseStatus.COMPLETED, res.status());
        assertEquals(PurchasePaymentStatus.UNPAID, res.paymentStatus());
        assertEquals(new BigDecimal("20.000"), h.inventoryService.currentStock(10L));
        assertEquals(new BigDecimal("10.000"), h.inventoryService.currentStock(11L));

        // Duplicate retry with same idempotencyKey must not duplicate purchase or stock
        PurchaseResponse retry = h.purchaseService.create(req, h.owner.getPhone());
        assertEquals(res.id(), retry.id());
        assertEquals(1, h.purchaseStore.size());
        assertEquals(new BigDecimal("20.000"), h.inventoryService.currentStock(10L));
    }

    @Test
    void supplierPaymentsPartialFullOverpaymentDuplicateAndBalance() {
        InMemoryHarness h = new InMemoryHarness();
        Supplier s = h.supplierService.create(new SupplierService.SupplierCreateUpdateRequest(
                "Agro Traders", SupplierType.WHOLESALE_MARKET, "9876500002", null, null, true));

        PurchaseResponse p1 = h.purchaseService.create(new PurchaseRequest(
                s.getId(), LocalDate.now(), BigDecimal.ZERO, "INV-101", "p1", null,
                List.of(new PurchaseItemRequest(10L, new BigDecimal("10.000"), new BigDecimal("50.00")))),
                h.owner.getPhone()); // 500.00

        // Zero/negative payment rejected
        assertThrows(BadRequestException.class, () -> h.supplierService.recordPayment(s.getId(),
                new SupplierService.RecordPaymentRequest(p1.id(), BigDecimal.ZERO, SupplierPaymentMethod.CASH,
                        LocalDate.now(), null, "pay-0", null),
                h.owner.getPhone()));

        // Partial payment 200.00
        SupplierService.SupplierPaymentResponse pay1 = h.supplierService.recordPayment(s.getId(),
                new SupplierService.RecordPaymentRequest(p1.id(), new BigDecimal("200.00"), SupplierPaymentMethod.UPI,
                        LocalDate.now(), "UTR123", "pay-1", "Part 1"),
                h.owner.getPhone());
        assertEquals(new BigDecimal("200.00"), pay1.amount());

        // Duplicate idempotency key returns same payment without double-counting
        SupplierService.SupplierPaymentResponse pay1Retry = h.supplierService.recordPayment(s.getId(),
                new SupplierService.RecordPaymentRequest(p1.id(), new BigDecimal("200.00"), SupplierPaymentMethod.UPI,
                        LocalDate.now(), "UTR123", "pay-1", "Part 1"),
                h.owner.getPhone());
        assertEquals(pay1.id(), pay1Retry.id());

        // Conflicting idempotency key rejected
        assertThrows(DuplicateResourceException.class, () -> h.supplierService.recordPayment(s.getId(),
                new SupplierService.RecordPaymentRequest(p1.id(), new BigDecimal("100.00"), SupplierPaymentMethod.UPI,
                        LocalDate.now(), "UTR123", "pay-1", "Conflict"),
                h.owner.getPhone()));

        // Overpayment (> 300.00 remaining) rejected
        assertThrows(BadRequestException.class, () -> h.supplierService.recordPayment(s.getId(),
                new SupplierService.RecordPaymentRequest(p1.id(), new BigDecimal("350.00"), SupplierPaymentMethod.CASH,
                        LocalDate.now(), null, "pay-over", null),
                h.owner.getPhone()));

        // Remaining full payment 300.00
        h.supplierService.recordPayment(s.getId(),
                new SupplierService.RecordPaymentRequest(p1.id(), new BigDecimal("300.00"),
                        SupplierPaymentMethod.BANK_TRANSFER, LocalDate.now(), "NEFT99", "pay-2", "Settled"),
                h.owner.getPhone());

        SupplierService.SupplierDetailResponse detail = h.supplierService.getDetail(s.getId());
        assertEquals(new BigDecimal("500.00"), detail.summary().totalPurchases());
        assertEquals(new BigDecimal("500.00"), detail.summary().totalPayments());
        assertEquals(new BigDecimal("0.00"), detail.summary().outstandingPayable());
        assertEquals(PurchasePaymentStatus.PAID, detail.purchases().get(0).paymentStatus());
    }

    @Test
    void concurrentPaymentsAcquiresLockAndPreventsOverpayment() throws Exception {
        InMemoryHarness h = new InMemoryHarness();
        Supplier s = h.supplierService.create(new SupplierService.SupplierCreateUpdateRequest(
                "Concurrent Farm", SupplierType.FARMER, "9876500003", null, null, true));

        PurchaseResponse p1 = h.purchaseService.create(new PurchaseRequest(
                s.getId(), LocalDate.now(), BigDecimal.ZERO, "INV-C1", "pc1", null,
                List.of(new PurchaseItemRequest(10L, new BigDecimal("10.000"), new BigDecimal("100.00")))),
                h.owner.getPhone()); // 1000.00

        // Serialize two concurrent 600.00 payment attempts via supplier row lock simulation
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        CallablePayment task1 = new CallablePayment(h, s.getId(), p1.id(), "600.00", "c-1", start);
        CallablePayment task2 = new CallablePayment(h, s.getId(), p1.id(), "600.00", "c-2", start);
        Future<Boolean> f1 = pool.submit(task1);
        Future<Boolean> f2 = pool.submit(task2);
        start.countDown();

        int successes = (f1.get() ? 1 : 0) + (f2.get() ? 1 : 0);
        pool.shutdown();

        assertEquals(1, successes, "Only one 600.00 payment can succeed against 1000.00 balance");
        assertTrue(h.lockAcquisitions.get() >= 2, "Pessimistic supplier lock must be acquired");
        assertEquals(new BigDecimal("400.00"),
                h.supplierService.getDetail(s.getId()).summary().outstandingPayable());
    }

    private record CallablePayment(InMemoryHarness h, Long sid, Long pid, String amt, String key, CountDownLatch start)
            implements java.util.concurrent.Callable<Boolean> {
        @Override
        public Boolean call() throws Exception {
            start.await();
            h.supplierRowLock.lock();
            try {
                h.supplierService.recordPayment(sid,
                        new SupplierService.RecordPaymentRequest(pid, new BigDecimal(amt),
                                SupplierPaymentMethod.CASH, LocalDate.now(), null, key, null),
                        h.owner.getPhone());
                return true;
            } catch (BadRequestException ex) {
                return false;
            } finally {
                h.supplierRowLock.unlock();
            }
        }
    }

    @Test
    void purchaseCancellationReversesStockAndExcludesFromPayable() {
        InMemoryHarness h = new InMemoryHarness();
        Supplier s = h.supplierService.create(new SupplierService.SupplierCreateUpdateRequest(
                "Cancelable Mandi", SupplierType.WHOLESALE_MARKET, "9876500004", null, null, true));

        PurchaseResponse p1 = h.purchaseService.create(new PurchaseRequest(
                s.getId(), LocalDate.now(), BigDecimal.ZERO, "INV-CAN1", "can-1", null,
                List.of(new PurchaseItemRequest(10L, new BigDecimal("15.000"), new BigDecimal("20.00")))),
                h.owner.getPhone());

        assertEquals(new BigDecimal("15.000"), h.inventoryService.currentStock(10L));

        PurchaseResponse cancelled = h.purchaseService.cancel(p1.id(), "Wrong entry", h.owner.getPhone());
        assertEquals(PurchaseStatus.CANCELLED, cancelled.status());
        assertEquals(PurchasePaymentStatus.CANCELLED, cancelled.paymentStatus());
        assertEquals(new BigDecimal("0.000"), h.inventoryService.currentStock(10L));
        assertEquals(MovementType.ADJUSTMENT, h.movements.get(h.movements.size() - 1).getType());

        SupplierService.SupplierDashboardResponse dash = h.supplierService.getDashboard(null, null);
        assertEquals(new BigDecimal("0.00"), dash.totalPurchases());
        assertEquals(new BigDecimal("0.00"), dash.totalOutstandingPayable());

        // Re-cancelling is rejected
        assertThrows(BadRequestException.class,
                () -> h.purchaseService.cancel(p1.id(), "Again", h.owner.getPhone()));
    }
}
