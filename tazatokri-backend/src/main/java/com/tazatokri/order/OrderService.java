
package com.tazatokri.order;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.catalog.VegetableUnit;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.delivery.DeliveryRules;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.user.Address;
import com.tazatokri.user.AddressRepository;
import com.tazatokri.user.UserRepository;

@Service
public class OrderService {

    private final CustomerOrderRepository orders;
    private final UserRepository users;
    private final AddressRepository addresses;
    private final VegetableRepository vegetables;
    private final VegetablePriceRepository prices;
    private final InventoryService inventory;
    private final DeliveryRules rules;

    public OrderService(
            CustomerOrderRepository orders,
            UserRepository users,
            AddressRepository addresses,
            VegetableRepository vegetables,
            VegetablePriceRepository prices,
            InventoryService inventory,
            DeliveryRules rules) {

        this.orders = orders;
        this.users = users;
        this.addresses = addresses;
        this.vegetables = vegetables;
        this.prices = prices;
        this.inventory = inventory;
        this.rules = rules;
    }

    @Transactional
    public OrderResponse place(PlaceOrderRequest req, String customerPhone) {

        // 1. Identify customer using the authenticated user's phone.
        Long customerId = users.findByPhone(customerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"))
                .getId();

        // 2. Idempotency check: only the same customer can reuse the reference.
        Optional<CustomerOrder> existing =
                orders.findWithDetailsByClientRef(req.clientRef());

        if (existing.isPresent()) {

            if (!existing.get().getCustomerId().equals(customerId)) {
                throw new DuplicateResourceException("Reference already used");
            }

            return OrderResponse.from(existing.get(), true);
        }

        // 3. Validate address ownership and delivery serviceability.
        Address address = addresses
                .findByIdAndUserId(req.addressId(), customerId)
                .filter(Address::isActive)
                .orElseThrow(() -> new BadRequestException("Address not found"));

        if (!rules.isServiceable(address.getPincode())) {
            throw new BadRequestException(
                    "We do not deliver to pincode "
                            + address.getPincode() + " yet"
            );
        }

        // 4. Convert selling-unit quantity into base-unit quantity.
        // TreeMap ensures vegetable IDs are processed in sorted order.
        Map<Long, Vegetable> loaded = new HashMap<>();
        TreeMap<Long, BigDecimal> qtyByVegetable = new TreeMap<>();

        for (OrderItemRequest r : req.items()) {

            Vegetable v = loaded.computeIfAbsent(
                    r.vegetableId(),
                    id -> vegetables.findWithDetailsById(id)
                            .orElseThrow(() ->
                                    new BadRequestException(
                                            "Vegetable does not exist: " + id
                                    ))
            );

            VegetableUnit unit = v.getUnits().stream()
                    .filter(u -> u.getId().equals(r.unitId()) && u.isActive())
                    .findFirst()
                    .orElseThrow(() ->
                            new BadRequestException(
                                    "Invalid selling option for " + v.getNameEn()
                            )
                    );

            BigDecimal qty = unit.getQuantityInBaseUnit()
                    .multiply(BigDecimal.valueOf(r.count()));

            qtyByVegetable.merge(v.getId(), qty, BigDecimal::add);
        }

        // 5. Create order.
        CustomerOrder order = new CustomerOrder();

        order.setClientRef(req.clientRef());
        order.setCustomerId(customerId);
        order.setPaymentMethod(req.paymentMethod());

        // COD orders are placed immediately.
        // Online orders wait for successful payment.
        order.setStatus(
                req.paymentMethod() == OrderPaymentMethod.ONLINE
                        ? OrderStatus.PENDING_PAYMENT
                        : OrderStatus.PLACED
        );

        order.setDeliveryAddress(formatAddress(address));
        order.setDeliveryPincode(address.getPincode());

        // 6. Validate vegetables and calculate prices from the database.
        BigDecimal subtotal = BigDecimal.ZERO;

        for (Map.Entry<Long, BigDecimal> e : qtyByVegetable.entrySet()) {

            Vegetable v = loaded.get(e.getKey());

            if (!v.isActive() || !v.isAvailable()) {
                throw new BadRequestException(
                        v.getNameEn() + " is not available today"
                );
            }

            VegetablePrice price = prices
                    .findFirstByVegetableIdOrderByIdDesc(v.getId())
                    .orElseThrow(() ->
                            new BadRequestException(
                                    v.getNameEn() + " is not available today"
                            )
                    );

            OrderItem item = new OrderItem();

            item.setOrder(order);
            item.setVegetable(v);
            item.setQuantity(e.getValue());
            item.setUnitPrice(price.getPricePerUnit());

            item.setEstimatedLineTotal(
                    e.getValue()
                            .multiply(price.getPricePerUnit())
                            .setScale(2, RoundingMode.HALF_UP)
            );

            order.getItems().add(item);

            subtotal = subtotal.add(item.getEstimatedLineTotal());
        }

        // 7. Minimum order validation.
        if (subtotal.compareTo(rules.minOrder()) < 0) {
            throw new BadRequestException(
                    "Minimum order is Rs " + rules.minOrder().toPlainString()
            );
        }

        // 8. Calculate delivery fee, total and delivery date.
        BigDecimal fee = rules.feeFor(subtotal);

        order.setSubtotal(subtotal);
        order.setDeliveryFee(fee);
        order.setEstimatedTotal(subtotal.add(fee));
        order.setDeliveryDate(
                rules.deliveryDateFor(LocalDateTime.now())
        );

        // 9. Save order to generate its database ID.
        CustomerOrder saved = orders.save(order);

        // 10. Record inventory movements.
        for (OrderItem item : saved.getItems()) {

            inventory.record(
                    item.getVegetable().getId(),
                    MovementType.ONLINE_SALE,
                    item.getQuantity(),
                    "Order #" + saved.getId(),
                    "ORDER",
                    saved.getId(),
                    customerPhone
            );
        }

        return OrderResponse.from(saved, true);
    }

    // ---------- Customer order details ----------

    @Transactional(readOnly = true)
    public OrderResponse get(Long id, String customerPhone) {

        Long customerId = users.findByPhone(customerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"))
                .getId();

        return OrderResponse.from(
                orders.findWithDetailsByIdAndCustomerId(id, customerId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Order not found: " + id
                                )
                        ),
                true
        );
    }

    // ---------- Customer order list ----------

    @Transactional(readOnly = true)
    public List<OrderResponse> list(String customerPhone, int page) {

        Long customerId = users.findByPhone(customerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"))
                .getId();

        return orders.findByCustomerId(
                        customerId,
                        PageRequest.of(
                                page,
                                20,
                                Sort.by(Sort.Direction.DESC, "id")
                        )
                )
                .map(o -> OrderResponse.from(o, false))
                .getContent();
    }

    // ---------- Address formatter ----------

    private String formatAddress(Address a) {

        return Stream.of(
                        a.getLine1(),
                        a.getLine2(),
                        a.getLandmark(),
                        a.getPincode()
                )
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.joining(", "));
    }
}
