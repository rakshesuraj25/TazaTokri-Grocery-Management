package com.tazatokri.order;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.catalog.VegetableUnit;
import com.tazatokri.combo.Combo;
import com.tazatokri.combo.ComboItem;
import com.tazatokri.combo.ComboRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.delivery.DeliveryRules;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.loyalty.LoyaltyService;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.retention.PromoOfferService;
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
    private final ComboRepository combos;
    private final Clock clock;

    @Autowired(required = false)
    private LoyaltyService loyaltyService;

    @Autowired(required = false)
    private PromoOfferService promoOfferService;

    public void setLoyaltyService(LoyaltyService loyaltyService) {
        this.loyaltyService = loyaltyService;
    }

    public void setPromoOfferService(PromoOfferService promoOfferService) {
        this.promoOfferService = promoOfferService;
    }

    public OrderService(
            CustomerOrderRepository orders,
            UserRepository users,
            AddressRepository addresses,
            VegetableRepository vegetables,
            VegetablePriceRepository prices,
            InventoryService inventory,
            DeliveryRules rules) {
        this(orders, users, addresses, vegetables, prices, inventory, rules, null, Clock.system(DeliveryRules.IST));
    }

    public OrderService(
            CustomerOrderRepository orders,
            UserRepository users,
            AddressRepository addresses,
            VegetableRepository vegetables,
            VegetablePriceRepository prices,
            InventoryService inventory,
            DeliveryRules rules,
            ComboRepository combos) {
        this(orders, users, addresses, vegetables, prices, inventory, rules, combos, Clock.system(DeliveryRules.IST));
    }

    @Autowired
    public OrderService(
            CustomerOrderRepository orders,
            UserRepository users,
            AddressRepository addresses,
            VegetableRepository vegetables,
            VegetablePriceRepository prices,
            InventoryService inventory,
            DeliveryRules rules,
            ComboRepository combos,
            Clock clock) {

        this.orders = orders;
        this.users = users;
        this.addresses = addresses;
        this.vegetables = vegetables;
        this.prices = prices;
        this.inventory = inventory;
        this.rules = rules;
        this.combos = combos;
        this.clock = clock != null ? clock : Clock.system(DeliveryRules.IST);
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

        List<OrderItemRequest> reqItems = req.items() == null ? List.of() : req.items();
        List<PlaceOrderRequest.OrderComboRequest> reqCombos = req.combos() == null ? List.of() : req.combos();
        if (reqItems.isEmpty() && reqCombos.isEmpty()) {
            throw new BadRequestException("Order must contain at least one item or combo");
        }

        if (!rules.isStoreOpen()) {
            throw new BadRequestException("Store is currently paused for new online orders");
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

        // 4. Convert selling-unit quantities and combo packs into base-unit quantities and price snapshots.
        // TreeMap ensures vegetable IDs are processed in sorted order (deadlock-safe).
        Map<Long, Vegetable> loaded = new HashMap<>();
        Map<Long, BigDecimal> latestPriceByVeg = new HashMap<>();
        TreeMap<Long, BigDecimal> qtyByVegetable = new TreeMap<>();
        TreeMap<Long, BigDecimal> lineTotalByVegetable = new TreeMap<>();

        for (OrderItemRequest r : reqItems) {
            Vegetable v = loaded.computeIfAbsent(
                    r.vegetableId(),
                    id -> vegetables.findWithDetailsById(id)
                            .orElseThrow(() ->
                                    new BadRequestException("Vegetable does not exist: " + id)));

            if (!v.isActive() || !v.isAvailable()) {
                throw new BadRequestException(v.getNameEn() + " is not available today");
            }

            VegetableUnit unit = v.getUnits().stream()
                    .filter(u -> u.getId().equals(r.unitId()) && u.isActive())
                    .findFirst()
                    .orElseThrow(() ->
                            new BadRequestException("Invalid selling option for " + v.getNameEn()));

            BigDecimal pricePerUnit = latestPriceByVeg.computeIfAbsent(
                    v.getId(),
                    id -> prices.findFirstByVegetableIdOrderByIdDesc(id)
                            .map(VegetablePrice::getPricePerUnit)
                            .orElseThrow(() -> new BadRequestException(v.getNameEn() + " is not available today")));

            BigDecimal qty = unit.getQuantityInBaseUnit()
                    .multiply(BigDecimal.valueOf(r.count()));
            BigDecimal lineTotal = qty.multiply(pricePerUnit).setScale(2, RoundingMode.HALF_UP);

            qtyByVegetable.merge(v.getId(), qty, BigDecimal::add);
            lineTotalByVegetable.merge(v.getId(), lineTotal, BigDecimal::add);
        }

        for (PlaceOrderRequest.OrderComboRequest cReq : reqCombos) {
            if (combos == null) {
                throw new BadRequestException("Combo packs are not enabled");
            }
            if (cReq.count() < 1) {
                throw new BadRequestException("Combo count must be at least 1");
            }
            Combo combo = combos.findWithDetailsById(cReq.comboId())
                    .orElseThrow(() -> new BadRequestException("Combo does not exist: " + cReq.comboId()));
            if (!combo.isActive() || !combo.isAvailable()) {
                throw new BadRequestException(combo.getNameEn() + " is not available today");
            }
            if (combo.getItems().isEmpty()) {
                throw new BadRequestException(combo.getNameEn() + " has no items");
            }

            List<ComboItem> sortedComboItems = new ArrayList<>(combo.getItems());
            sortedComboItems.sort(Comparator.comparing(ci -> ci.getVegetable().getId()));

            BigDecimal countDec = BigDecimal.valueOf(cReq.count());
            BigDecimal comboTotalPrice = combo.getSellingPrice()
                    .multiply(countDec)
                    .setScale(2, RoundingMode.HALF_UP);

            // Compute regular weight of each constituent vegetable to allocate the combo selling price snapshot proportionally
            BigDecimal regularComboTotal = BigDecimal.ZERO;
            List<BigDecimal> regularLineTotals = new ArrayList<>(sortedComboItems.size());

            for (ComboItem ci : sortedComboItems) {
                Vegetable v = ci.getVegetable();
                loaded.putIfAbsent(v.getId(), v);
                if (!v.isActive() || !v.isAvailable()) {
                    throw new BadRequestException(
                            v.getNameEn() + " in " + combo.getNameEn() + " is not available today");
                }
                BigDecimal vegPrice = latestPriceByVeg.computeIfAbsent(
                        v.getId(),
                        id -> prices.findFirstByVegetableIdOrderByIdDesc(id)
                                .map(VegetablePrice::getPricePerUnit)
                                .orElseThrow(() -> new BadRequestException(
                                        v.getNameEn() + " in " + combo.getNameEn() + " is not available today")));

                BigDecimal totalVegQty = ci.getQuantityInBaseUnit().multiply(countDec);
                BigDecimal regLine = totalVegQty.multiply(vegPrice).setScale(2, RoundingMode.HALF_UP);
                regularLineTotals.add(regLine);
                regularComboTotal = regularComboTotal.add(regLine);
            }

            BigDecimal allocatedSoFar = BigDecimal.ZERO;
            for (int idx = 0; idx < sortedComboItems.size(); idx++) {
                ComboItem ci = sortedComboItems.get(idx);
                Long vegId = ci.getVegetable().getId();
                BigDecimal totalVegQty = ci.getQuantityInBaseUnit().multiply(countDec);

                BigDecimal allocatedLine;
                if (idx == sortedComboItems.size() - 1) {
                    allocatedLine = comboTotalPrice.subtract(allocatedSoFar);
                } else if (regularComboTotal.signum() > 0) {
                    allocatedLine = comboTotalPrice
                            .multiply(regularLineTotals.get(idx))
                            .divide(regularComboTotal, 2, RoundingMode.HALF_UP);
                    allocatedSoFar = allocatedSoFar.add(allocatedLine);
                } else {
                    allocatedLine = comboTotalPrice
                            .divide(BigDecimal.valueOf(sortedComboItems.size()), 2, RoundingMode.HALF_UP);
                    allocatedSoFar = allocatedSoFar.add(allocatedLine);
                }

                qtyByVegetable.merge(vegId, totalVegQty, BigDecimal::add);
                lineTotalByVegetable.merge(vegId, allocatedLine, BigDecimal::add);
            }
        }

        // 5. Create order.
        CustomerOrder order = new CustomerOrder();
        order.setClientRef(req.clientRef());
        order.setCustomerId(customerId);
        order.setPaymentMethod(req.paymentMethod());

        order.setStatus(
                req.paymentMethod() == OrderPaymentMethod.ONLINE
                        ? OrderStatus.PENDING_PAYMENT
                        : OrderStatus.PLACED
        );

        order.setDeliveryAddress(formatAddress(address));
        order.setDeliveryPincode(address.getPincode());
        order.setDeliveryInstructions(address.getDeliveryInstructions());

        // 6. Build OrderItems with price snapshot.
        BigDecimal subtotal = BigDecimal.ZERO;

        for (Map.Entry<Long, BigDecimal> e : qtyByVegetable.entrySet()) {
            Long vegId = e.getKey();
            BigDecimal totalQty = e.getValue().setScale(3, RoundingMode.HALF_UP);
            BigDecimal lineTotal = lineTotalByVegetable.getOrDefault(vegId, BigDecimal.ZERO)
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal effectiveUnitPrice = totalQty.signum() > 0
                    ? lineTotal.divide(totalQty, 2, RoundingMode.HALF_UP)
                    : latestPriceByVeg.getOrDefault(vegId, BigDecimal.ZERO);

            Vegetable v = loaded.get(vegId);

            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setVegetable(v);
            item.setQuantity(totalQty);
            item.setUnitPrice(effectiveUnitPrice);
            item.setEstimatedLineTotal(lineTotal);

            order.getItems().add(item);
            subtotal = subtotal.add(lineTotal);
        }

        // 7. Minimum order validation.
        if (subtotal.compareTo(rules.minOrder()) < 0) {
            throw new BadRequestException(
                    "Minimum order is Rs " + rules.minOrder().toPlainString()
            );
        }

        // 8. Calculate delivery fee, optional loyalty & promo redemptions, total and delivery date.
        BigDecimal fee = rules.feeFor(subtotal);
        int requestedRedeem = req.redeemPoints() != null ? req.redeemPoints() : 0;
        LoyaltyService.RedemptionCalculation redemption = new LoyaltyService.RedemptionCalculation(
                0, BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        if (requestedRedeem > 0) {
            if (loyaltyService == null) {
                throw new BadRequestException("Loyalty rewards program is not available");
            }
            redemption = loyaltyService.validateAndLockForRedemption(customerId, requestedRedeem, subtotal);
        }

        PromoOfferService.AppliedPromo appliedPromo = null;
        if (req.promoCode() != null && !req.promoCode().isBlank()) {
            if (promoOfferService == null) {
                throw new BadRequestException("Promotional offers are not available");
            }
            appliedPromo = promoOfferService.validateAndLockForOrder(
                    req.promoCode(), customerId, subtotal, redemption.discountAmount());
        }
        BigDecimal promoDiscount = appliedPromo != null
                ? appliedPromo.discountAmount()
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        order.setSubtotal(subtotal);
        order.setDeliveryFee(fee);
        order.setLoyaltyPointsRedeemed(redemption.pointsRedeemed());
        order.setLoyaltyDiscountAmount(redemption.discountAmount());
        order.setPromoCode(appliedPromo != null ? appliedPromo.code() : null);
        order.setPromoDiscountAmount(promoDiscount);
        BigDecimal netItems = subtotal.subtract(redemption.discountAmount()).subtract(promoDiscount).max(BigDecimal.ZERO);
        order.setEstimatedTotal(netItems.add(fee));
        order.setDeliveryDate(
                rules.deliveryDateFor(LocalDateTime.now(clock.withZone(DeliveryRules.IST)))
        );

        // 9. Save order to generate its database ID.
        CustomerOrder saved = orders.save(order);
        if (redemption.pointsRedeemed() > 0 && loyaltyService != null) {
            loyaltyService.recordRedemptionForOrder(customerId, saved.getId(), redemption);
        }
        if (appliedPromo != null && promoOfferService != null) {
            promoOfferService.recordRedemption(appliedPromo, customerId, saved.getId());
        }

        // 10. Record inventory movements (in sorted vegetable ID order, validating stock with pessimistic locks).
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
                .map(o -> OrderResponse.from(o, true))
                .getContent();
    }

    @Transactional
    public OrderResponse updateDeliveryInstructions(Long id, String instructions, String customerPhone) {
        Long customerId = users.findByPhone(customerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"))
                .getId();
        CustomerOrder o = orders.findWithDetailsByIdAndCustomerId(id, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));
        if (o.getStatus() != OrderStatus.PENDING_PAYMENT
                && o.getStatus() != OrderStatus.PLACED
                && o.getStatus() != OrderStatus.CONFIRMED) {
            throw new BadRequestException("Delivery instructions cannot be modified once packing has started.");
        }
        String cleaned = (instructions == null || instructions.isBlank()) ? null : instructions.trim();
        if (cleaned != null && cleaned.length() > 255) {
            cleaned = cleaned.substring(0, 255);
        }
        o.setDeliveryInstructions(cleaned);
        return OrderResponse.from(orders.save(o), true);
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
