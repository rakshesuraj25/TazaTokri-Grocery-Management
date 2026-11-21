package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.catalog.VegetableUnit;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.delivery.DeliveryRules;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.inventory.StockMovement;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderItemRequest;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.order.OrderResponse;
import com.tazatokri.order.OrderService;
import com.tazatokri.order.PlaceOrderRequest;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.user.Address;
import com.tazatokri.user.AddressRepository;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class OrderCutoffTests {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private DeliveryRules defaultRules(Clock clock) {
        return new DeliveryRules(
                List.of("411026", "411039"),
                new BigDecimal("150.00"),
                new BigDecimal("30.00"),
                new BigDecimal("300.00"),
                "18:00",
                null,
                clock);
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    private OrderService buildOrderService(DeliveryRules rules, Clock clock, CustomerOrder existingOrder) {
        User customer = new User();
        setField(customer, "id", 1L);
        customer.setPhone("9123456789");
        customer.setFullName("Test Customer");

        Address address = new Address();
        setField(address, "id", 501L);
        address.setUserId(1L);
        address.setActive(true);
        address.setLine1("Flat 101");
        address.setPincode("411026");

        Vegetable veg = new Vegetable();
        setField(veg, "id", 20L);
        veg.setNameEn("Tomato");
        veg.setActive(true);
        veg.setAvailable(true);
        veg.setBaseUnit(UnitType.KG);

        VegetableUnit unit = new VegetableUnit();
        setField(unit, "id", 201L);
        unit.setLabel("1 kg");
        unit.setQuantityInBaseUnit(BigDecimal.ONE);
        unit.setActive(true);
        veg.getUnits().add(unit);

        VegetablePrice price = newInstance(VegetablePrice.class);
        setField(price, "pricePerUnit", new BigDecimal("50.00"));

        CustomerOrderRepository orders = proxy(CustomerOrderRepository.class, (p, m, a) -> {
            if ("findWithDetailsByClientRef".equals(m.getName())) {
                String ref = (String) a[0];
                if (existingOrder != null && existingOrder.getClientRef().equals(ref)) {
                    return Optional.of(existingOrder);
                }
                return Optional.empty();
            }
            if ("save".equals(m.getName())) {
                CustomerOrder o = (CustomerOrder) a[0];
                setField(o, "id", 9001L);
                return o;
            }
            return null;
        });

        UserRepository users = proxy(UserRepository.class, (p, m, a) -> {
            if ("findByPhone".equals(m.getName()) && "9123456789".equals(a[0])) {
                return Optional.of(customer);
            }
            return Optional.empty();
        });

        AddressRepository addresses = proxy(AddressRepository.class, (p, m, a) -> {
            if ("findByIdAndUserId".equals(m.getName())
                    && Long.valueOf(501L).equals(a[0])
                    && Long.valueOf(1L).equals(a[1])) {
                return Optional.of(address);
            }
            return Optional.empty();
        });

        VegetableRepository vegetables = proxy(VegetableRepository.class, (p, m, a) -> {
            if (("findWithDetailsById".equals(m.getName()) || "findById".equals(m.getName()))
                    && Long.valueOf(20L).equals(a[0])) {
                return Optional.of(veg);
            }
            return Optional.empty();
        });

        VegetablePriceRepository prices = proxy(VegetablePriceRepository.class, (p, m, a) -> {
            if ("findFirstByVegetableIdOrderByIdDesc".equals(m.getName()) && Long.valueOf(20L).equals(a[0])) {
                return Optional.of(price);
            }
            return Optional.empty();
        });

        InventoryService inventory = new InventoryService(null, null, null) {
            @Override
            public StockMovement record(Long vegetableId, MovementType type, BigDecimal quantity,
                    String note, String refType, Long refId, String actorPhone) {
                return null;
            }
        };

        return new OrderService(orders, users, addresses, vegetables, prices, inventory, rules, null, clock);
    }

    private PlaceOrderRequest sampleOrder(String clientRef) {
        return new PlaceOrderRequest(
                clientRef,
                501L,
                OrderPaymentMethod.COD,
                List.of(new OrderItemRequest(20L, 201L, 4)));
    }

    private static <T> T newInstance(Class<T> type) {
        try {
            Constructor<T> ctor = type.getDeclaredConstructor();
            ctor.setAccessible(true);
            return ctor.newInstance();
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
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
    void orderPlacedBeforeCutoffSchedulesSameDayDelivery() {
        Instant beforeCutoff = ZonedDateTime.of(2026, 11, 21, 17, 59, 59, 0, IST).toInstant();
        Clock clock = Clock.fixed(beforeCutoff, IST);
        DeliveryRules rules = defaultRules(clock);
        OrderService service = buildOrderService(rules, clock, null);

        OrderResponse res = service.place(sampleOrder("ref-before"), "9123456789");
        assertEquals(LocalDate.of(2026, 11, 21), res.deliveryDate());
    }

    @Test
    void orderPlacedExactlyAtCutoffSchedulesNextDayDelivery() {
        Instant atCutoff = ZonedDateTime.of(2026, 11, 21, 18, 0, 0, 0, IST).toInstant();
        Clock clock = Clock.fixed(atCutoff, IST);
        DeliveryRules rules = defaultRules(clock);
        OrderService service = buildOrderService(rules, clock, null);

        OrderResponse res = service.place(sampleOrder("ref-at"), "9123456789");
        assertEquals(LocalDate.of(2026, 11, 22), res.deliveryDate());
    }

    @Test
    void orderPlacedAfterCutoffSchedulesNextDayDelivery() {
        Instant afterCutoff = ZonedDateTime.of(2026, 11, 21, 18, 0, 1, 0, IST).toInstant();
        Clock clock = Clock.fixed(afterCutoff, IST);
        DeliveryRules rules = defaultRules(clock);
        OrderService service = buildOrderService(rules, clock, null);

        OrderResponse res = service.place(sampleOrder("ref-after"), "9123456789");
        assertEquals(LocalDate.of(2026, 11, 22), res.deliveryDate());
    }

    @Test
    void cutoffEvaluationConvertsUtcClockToIstTimezone() {
        // 12:29:59 UTC == 17:59:59 IST -> same-day delivery (2026-11-21)
        Clock utcBeforeCutoff = Clock.fixed(Instant.parse("2026-11-21T12:29:59Z"), ZoneOffset.UTC);
        DeliveryRules rulesBefore = defaultRules(utcBeforeCutoff);
        OrderService serviceBefore = buildOrderService(rulesBefore, utcBeforeCutoff, null);
        assertEquals(LocalDate.of(2026, 11, 21),
                serviceBefore.place(sampleOrder("ref-utc-before"), "9123456789").deliveryDate());
        assertEquals(LocalDate.of(2026, 11, 21), rulesBefore.deliveryDateFor());

        // 12:30:00 UTC == 18:00:00 IST -> next-day delivery (2026-11-22)
        Clock utcAtCutoff = Clock.fixed(Instant.parse("2026-11-21T12:30:00Z"), ZoneOffset.UTC);
        DeliveryRules rulesAt = defaultRules(utcAtCutoff);
        OrderService serviceAt = buildOrderService(rulesAt, utcAtCutoff, null);
        assertEquals(LocalDate.of(2026, 11, 22),
                serviceAt.place(sampleOrder("ref-utc-at"), "9123456789").deliveryDate());
        assertEquals(LocalDate.of(2026, 11, 22), rulesAt.deliveryDateFor());
    }

    @Test
    void respectsUpdatedCutoffTimeFromStoreSettings() {
        // 14:30 IST with default 18:00 cutoff -> same day
        Instant twoThirtyPmIst = ZonedDateTime.of(2026, 11, 21, 14, 30, 0, 0, IST).toInstant();
        Clock clock = Clock.fixed(twoThirtyPmIst, IST);
        DeliveryRules rules = defaultRules(clock);
        OrderService service = buildOrderService(rules, clock, null);

        assertEquals(LocalDate.of(2026, 11, 21),
                service.place(sampleOrder("ref-1430-default"), "9123456789").deliveryDate());

        // Owner changes cutoff to 14:00 -> 14:30 IST is now next day
        rules.updateSettings(
                List.of("411026", "411039"),
                new BigDecimal("150.00"),
                new BigDecimal("30.00"),
                new BigDecimal("300.00"),
                "14:00",
                true);

        assertEquals(LocalDate.of(2026, 11, 22),
                service.place(sampleOrder("ref-1430-updated"), "9123456789").deliveryDate());
    }

    @Test
    void storePausedRejectsNewOrdersRegardlessOfCutoffWithoutAffectingExistingOrders() {
        Instant beforeCutoff = ZonedDateTime.of(2026, 11, 21, 10, 0, 0, 0, IST).toInstant();
        Clock clock = Clock.fixed(beforeCutoff, IST);
        DeliveryRules rules = defaultRules(clock);
        rules.updateSettings(
                List.of("411026", "411039"),
                new BigDecimal("150.00"),
                new BigDecimal("30.00"),
                new BigDecimal("300.00"),
                "18:00",
                false);

        CustomerOrder existingOrder = new CustomerOrder();
        setField(existingOrder, "id", 777L);
        existingOrder.setCustomerId(1L);
        existingOrder.setClientRef("existing-ref");
        existingOrder.setDeliveryAddress("Flat 101, 411026");
        existingOrder.setDeliveryDate(LocalDate.of(2026, 11, 21));
        existingOrder.setSubtotal(new BigDecimal("200.00"));
        existingOrder.setDeliveryFee(new BigDecimal("30.00"));
        existingOrder.setEstimatedTotal(new BigDecimal("230.00"));

        OrderService service = buildOrderService(rules, clock, existingOrder);

        // New order before cutoff is rejected when store is paused
        assertThrows(BadRequestException.class,
                () -> service.place(sampleOrder("new-while-paused"), "9123456789"));

        // Idempotent replay of an existing order is unaffected
        OrderResponse replayed = service.place(sampleOrder("existing-ref"), "9123456789");
        assertEquals(777L, replayed.id());
        assertEquals(LocalDate.of(2026, 11, 21), replayed.deliveryDate());
    }
}
