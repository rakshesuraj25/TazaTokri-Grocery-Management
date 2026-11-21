
package com.tazatokri.order;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.loyalty.LoyaltyService;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.retention.PromoOfferService;
import com.tazatokri.user.UserRepository;

@Service
public class OrderFlowService {

    private static final Set<OrderStatus> CANCEL_BEFORE_PACK =
            EnumSet.of(
                    OrderStatus.PENDING_PAYMENT,
                    OrderStatus.PLACED,
                    OrderStatus.CONFIRMED
            );

    private static final Set<OrderStatus> CANCEL_OWNER =
            EnumSet.of(
                    OrderStatus.PENDING_PAYMENT,
                    OrderStatus.PLACED,
                    OrderStatus.CONFIRMED,
                    OrderStatus.PACKED
            );

    private final CustomerOrderRepository orders;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private LoyaltyService loyaltyService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private PromoOfferService promoOfferService;

    public void setLoyaltyService(LoyaltyService loyaltyService) {
        this.loyaltyService = loyaltyService;
    }

    public void setPromoOfferService(PromoOfferService promoOfferService) {
        this.promoOfferService = promoOfferService;
    }
    private final UserRepository users;
    private final InventoryService inventory;
    private final PaymentService paymentService;
    private final BigDecimal maxOverFactor;

    public OrderFlowService(
            CustomerOrderRepository orders,
            UserRepository users,
            InventoryService inventory,
            PaymentService paymentService,
            @Value("${app.order.max-over-percent}") BigDecimal maxOverPercent) {

        if (maxOverPercent.signum() < 0 ||
                maxOverPercent.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalStateException("Invalid app.order.max-over-percent");
        }

        this.orders = orders;
        this.users = users;
        this.inventory = inventory;
        this.paymentService = paymentService;

        this.maxOverFactor = BigDecimal.ONE.add(
                maxOverPercent.divide(
                        BigDecimal.valueOf(100),
                        4,
                        RoundingMode.HALF_UP
                )
        );
    }

    // ---------- staff reads ----------

    @Transactional(readOnly = true)
    public List<OrderResponse> listForStaff(LocalDate date, OrderStatus status) {

        LocalDate d = (date == null) ? LocalDate.now() : date;

        List<CustomerOrder> list = (status == null)
                ? orders.findByDeliveryDateOrderByIdDesc(d)
                : orders.findByDeliveryDateAndStatusOrderByIdDesc(d, status);

        return list.stream()
                .map(o -> OrderResponse.from(o, true))
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse getForStaff(Long id) {

        return OrderResponse.from(
                orders.findWithDetailsById(id)
                        .orElseThrow(() ->
                                new ResourceNotFoundException("Order not found: " + id)),
                true
        );
    }

    // ---------- confirm ----------

    @Transactional
    public OrderResponse confirm(Long id) {

        CustomerOrder o = lock(id);

        requireStatus(o, OrderStatus.PLACED);

        o.setStatus(OrderStatus.CONFIRMED);

        return OrderResponse.from(o, true);
    }

    // ---------- pack ----------

    @Transactional
    public OrderResponse pack(Long id, PackRequest req, String actorPhone) {

        CustomerOrder o = lock(id);

        requireStatus(o, OrderStatus.CONFIRMED);

        Map<Long, BigDecimal> actual = new HashMap<>();

        for (PackRequest.Line l : req.items()) {

            if (actual.put(
                    l.vegetableId(),
                    l.actualQuantity().setScale(3, RoundingMode.HALF_UP)
            ) != null) {
                throw new BadRequestException(
                        "Vegetable repeated: " + l.vegetableId()
                );
            }
        }

        if (actual.size() != o.getItems().size()) {
            throw new BadRequestException(
                    "Give the packed weight of every item in the order"
            );
        }

        if (actual.values().stream().noneMatch(q -> q.signum() > 0)) {
            throw new BadRequestException(
                    "Nothing to pack. Cancel the order instead"
            );
        }

        // Sort by vegetable ID so inventory locks are acquired consistently.
        List<OrderItem> items = o.getItems().stream()
                .sorted(Comparator.comparing(i -> i.getVegetable().getId()))
                .toList();

        BigDecimal itemsTotal = BigDecimal.ZERO;

        for (OrderItem item : items) {

            BigDecimal a = actual.get(item.getVegetable().getId());

            if (a == null) {
                throw new BadRequestException(
                        "Missing weight for " + item.getVegetable().getNameEn()
                );
            }

            BigDecimal max = item.getQuantity()
                    .multiply(maxOverFactor)
                    .setScale(3, RoundingMode.DOWN);

            if (a.compareTo(max) > 0) {
                throw new BadRequestException(
                        item.getVegetable().getNameEn()
                                + ": packed weight is too far above the ordered "
                                + item.getQuantity().stripTrailingZeros().toPlainString()
                );
            }

            BigDecimal diff = a.subtract(item.getQuantity());

            if (diff.signum() > 0) {

                inventory.record(
                        item.getVegetable().getId(),
                        MovementType.ONLINE_SALE,
                        diff,
                        "Order #" + o.getId() + " packed above ordered weight",
                        "ORDER",
                        o.getId(),
                        actorPhone
                );

            } else if (diff.signum() < 0) {

                inventory.record(
                        item.getVegetable().getId(),
                        MovementType.ONLINE_CANCEL_RETURN,
                        diff.negate(),
                        "Order #" + o.getId() + " packed below ordered weight",
                        "ORDER",
                        o.getId(),
                        actorPhone
                );
            }

            item.setActualQuantity(a);

            item.setFinalLineTotal(
                    a.multiply(item.getUnitPrice())
                            .setScale(2, RoundingMode.HALF_UP)
            );

            itemsTotal = itemsTotal.add(item.getFinalLineTotal());
        }

        BigDecimal loyaltyDiscount = o.getLoyaltyDiscountAmount() != null
                ? o.getLoyaltyDiscountAmount()
                : BigDecimal.ZERO;
        BigDecimal promoDiscount = o.getPromoDiscountAmount() != null
                ? o.getPromoDiscountAmount()
                : BigDecimal.ZERO;
        BigDecimal netItemsTotal = itemsTotal.subtract(loyaltyDiscount).subtract(promoDiscount).max(BigDecimal.ZERO);
        o.setFinalTotal(netItemsTotal.add(o.getDeliveryFee()));

        o.setStatus(OrderStatus.PACKED);

        // Queue refund after calculating the final packed amount.
        paymentService.queueRefund(o.getId(), o.getFinalTotal());

        return OrderResponse.from(o, true);
    }

    // ---------- cancel ----------

    @Transactional
    public OrderResponse cancelByCustomer(
            Long id,
            String reason,
            String customerPhone) {

        Long customerId = users.findByPhone(customerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"))
                .getId();

        CustomerOrder o = lock(id);

        if (!o.getCustomerId().equals(customerId)) {
            throw new ResourceNotFoundException("Order not found: " + id);
        }

        return cancel(o, reason, customerPhone, CANCEL_BEFORE_PACK);
    }

    @Transactional
    public OrderResponse cancelByStaff(
            Long id,
            String reason,
            String actorPhone,
            boolean owner) {

        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("A reason is required");
        }

        CustomerOrder o = lock(id);

        return cancel(
                o,
                reason,
                actorPhone,
                owner ? CANCEL_OWNER : CANCEL_BEFORE_PACK
        );
    }

    private OrderResponse cancel(
            CustomerOrder o,
            String reason,
            String actorPhone,
            Set<OrderStatus> allowed) {

        if (!allowed.contains(o.getStatus())) {
            throw new InvalidOrderStateException(
                    "Order cannot be cancelled when it is " + o.getStatus()
            );
        }

        List<OrderItem> items = o.getItems().stream()
                .sorted(Comparator.comparing(i -> i.getVegetable().getId()))
                .toList();

        for (OrderItem item : items) {

            BigDecimal deducted = (item.getActualQuantity() != null)
                    ? item.getActualQuantity()
                    : item.getQuantity();

            if (deducted.signum() > 0) {

                inventory.record(
                        item.getVegetable().getId(),
                        MovementType.ONLINE_CANCEL_RETURN,
                        deducted,
                        "Order #" + o.getId() + " cancelled",
                        "ORDER",
                        o.getId(),
                        actorPhone
                );
            }
        }

        o.setStatus(OrderStatus.CANCELLED);

        o.setCancelReason(
                (reason == null || reason.isBlank()) ? null : reason.trim()
        );

        // Queue the refund for the cancelled order.
        paymentService.queueRefund(o.getId(), BigDecimal.ZERO);

        if (loyaltyService != null) {
            loyaltyService.reverseForCancelledOrder(o);
        }

        if (promoOfferService != null && o.getPromoCode() != null && !o.getPromoCode().isBlank()) {
            promoOfferService.releaseRedemptionForCancelledOrder(o.getId());
        }

        return OrderResponse.from(o, true);
    }

    // ---------- helpers ----------

    private CustomerOrder lock(Long id) {

        return orders.findByIdForUpdate(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Order not found: " + id));
    }

    private void requireStatus(CustomerOrder o, OrderStatus expected) {

        if (o.getStatus() != expected) {
            throw new InvalidOrderStateException(
                    "Order is " + o.getStatus() + ", expected " + expected
            );
        }
    }
    
    /** Called by the expiry job inside its own locked transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void expireLocked(CustomerOrder o, String customerPhone) {
        requireStatus(o, OrderStatus.PENDING_PAYMENT);
        cancel(o, "Payment not completed in time", customerPhone, CANCEL_BEFORE_PACK);
    }
}
