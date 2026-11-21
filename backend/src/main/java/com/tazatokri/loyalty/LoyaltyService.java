package com.tazatokri.loyalty;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class LoyaltyService {

    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    public record LoyaltySettingsDto(
            boolean enabled,
            BigDecimal pointsPer100Inr,
            BigDecimal rupeesPerPoint,
            int minRedeemPoints,
            int maxRedeemPointsPerOrder,
            Integer expiryDays) {
        public static LoyaltySettingsDto from(LoyaltySettings s) {
            return new LoyaltySettingsDto(
                    s.isEnabled(),
                    s.getPointsPer100Inr(),
                    s.getRupeesPerPoint(),
                    s.getMinRedeemPoints(),
                    s.getMaxRedeemPointsPerOrder(),
                    s.getExpiryDays());
        }
    }

    public record UpdateLoyaltySettingsRequest(
            boolean enabled,
            BigDecimal pointsPer100Inr,
            BigDecimal rupeesPerPoint,
            int minRedeemPoints,
            int maxRedeemPointsPerOrder,
            Integer expiryDays) {}

    public record LoyaltyTxDto(
            Long id,
            Long orderId,
            LoyaltyTransactionType type,
            int points,
            BigDecimal rupeeValue,
            String description,
            LocalDateTime expiresAt,
            LocalDateTime createdAt) {
        public static LoyaltyTxDto from(LoyaltyTransaction t) {
            return new LoyaltyTxDto(
                    t.getId(),
                    t.getOrderId(),
                    t.getType(),
                    t.getPoints(),
                    t.getRupeeValue(),
                    t.getDescription(),
                    t.getExpiresAt(),
                    t.getCreatedAt());
        }
    }

    public record CustomerLoyaltyDto(
            boolean enabled,
            long balance,
            BigDecimal pointsPer100Inr,
            BigDecimal rupeesPerPoint,
            int minRedeemPoints,
            int maxRedeemPointsPerOrder,
            Integer expiryDays,
            List<LoyaltyTxDto> transactions) {}

    public record RedemptionCalculation(
            int pointsRedeemed,
            BigDecimal discountAmount) {}

    public record LoyaltyAnalyticsSummary(
            long pointsIssued,
            long pointsRedeemed,
            long outstandingPointsLiability,
            long loyaltyRedemptionOrders) {}

    private final LoyaltySettingsRepository settingsRepo;
    private final LoyaltyTransactionRepository txRepo;
    private final UserRepository users;
    private final Clock clock;

    public LoyaltyService(
            LoyaltySettingsRepository settingsRepo,
            LoyaltyTransactionRepository txRepo,
            UserRepository users) {
        this(settingsRepo, txRepo, users, Clock.system(IST));
    }

    @Autowired
    public LoyaltyService(
            LoyaltySettingsRepository settingsRepo,
            LoyaltyTransactionRepository txRepo,
            UserRepository users,
            Clock clock) {
        this.settingsRepo = settingsRepo;
        this.txRepo = txRepo;
        this.users = users;
        this.clock = clock != null ? clock : Clock.system(IST);
    }

    @Transactional(readOnly = true)
    public LoyaltySettingsDto getSettings() {
        return LoyaltySettingsDto.from(loadOrDefaultSettings());
    }

    @Transactional
    public LoyaltySettingsDto updateSettings(UpdateLoyaltySettingsRequest req, String ownerPhone) {
        if (req == null) {
            throw new BadRequestException("Loyalty settings payload is required");
        }
        if (req.pointsPer100Inr() == null || req.pointsPer100Inr().signum() < 0) {
            throw new BadRequestException("Points per Rs 100 must be 0 or greater");
        }
        if (req.rupeesPerPoint() == null || req.rupeesPerPoint().signum() <= 0) {
            throw new BadRequestException("Rupees per point must be greater than 0");
        }
        if (req.minRedeemPoints() < 1) {
            throw new BadRequestException("Minimum redeem points must be at least 1");
        }
        if (req.maxRedeemPointsPerOrder() < req.minRedeemPoints()) {
            throw new BadRequestException("Maximum redeem points per order must be >= minimum redeem points");
        }
        if (req.expiryDays() != null && req.expiryDays() < 1) {
            throw new BadRequestException("Expiry days must be at least 1 when set");
        }

        Long ownerId = users.findByPhone(ownerPhone).map(User::getId).orElse(null);

        LoyaltySettings s = settingsRepo.findById(1L).orElseGet(() -> {
            LoyaltySettings fresh = new LoyaltySettings();
            fresh.setId(1L);
            return fresh;
        });
        s.setEnabled(req.enabled());
        s.setPointsPer100Inr(req.pointsPer100Inr().setScale(2, RoundingMode.HALF_UP));
        s.setRupeesPerPoint(req.rupeesPerPoint().setScale(4, RoundingMode.HALF_UP));
        s.setMinRedeemPoints(req.minRedeemPoints());
        s.setMaxRedeemPointsPerOrder(req.maxRedeemPointsPerOrder());
        s.setExpiryDays(req.expiryDays());
        s.setUpdatedBy(ownerId);
        s.setUpdatedAt(nowIst());
        return LoyaltySettingsDto.from(settingsRepo.save(s));
    }

    @Transactional(readOnly = true)
    public CustomerLoyaltyDto getCustomerLoyalty(String customerPhone) {
        User u = users.findByPhone(customerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"));
        LoyaltySettings s = loadOrDefaultSettings();
        long balance = Math.max(0L, txRepo.sumActivePointsForCustomer(u.getId(), nowIst()));
        List<LoyaltyTxDto> history = txRepo
                .findByCustomerIdOrderByCreatedAtDescIdDesc(u.getId(), PageRequest.of(0, 50))
                .stream()
                .map(LoyaltyTxDto::from)
                .toList();
        return new CustomerLoyaltyDto(
                s.isEnabled(),
                balance,
                s.getPointsPer100Inr(),
                s.getRupeesPerPoint(),
                s.getMinRedeemPoints(),
                s.getMaxRedeemPointsPerOrder(),
                s.getExpiryDays(),
                history);
    }

    /**
     * Validates and calculates loyalty redemption discount server-side, locking the customer row
     * so concurrent checkout requests cannot overspend the available balance.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public RedemptionCalculation validateAndLockForRedemption(
            Long customerId,
            int requestedPoints,
            BigDecimal itemsSubtotal) {
        if (requestedPoints <= 0) {
            return new RedemptionCalculation(0, BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        }
        LoyaltySettings s = loadOrDefaultSettings();
        if (!s.isEnabled()) {
            throw new BadRequestException("Loyalty rewards program is currently disabled");
        }
        if (requestedPoints < s.getMinRedeemPoints()) {
            throw new BadRequestException("Minimum " + s.getMinRedeemPoints() + " points required to redeem");
        }
        if (requestedPoints > s.getMaxRedeemPointsPerOrder()) {
            throw new BadRequestException("Maximum " + s.getMaxRedeemPointsPerOrder() + " points can be redeemed per order");
        }

        // Lock customer row to serialize concurrent redemptions
        users.findByIdForUpdate(customerId);
        long balance = Math.max(0L, txRepo.sumActivePointsForCustomer(customerId, nowIst()));
        if (requestedPoints > balance) {
            throw new BadRequestException("Insufficient loyalty points balance");
        }

        BigDecimal rawDiscount = BigDecimal.valueOf(requestedPoints)
                .multiply(s.getRupeesPerPoint())
                .setScale(2, RoundingMode.HALF_UP);
        // Never allow loyalty discount to exceed itemsSubtotal (delivery fee & min-order rules remain intact)
        if (rawDiscount.compareTo(itemsSubtotal) > 0) {
            throw new BadRequestException("Loyalty discount cannot exceed order items subtotal");
        }
        return new RedemptionCalculation(requestedPoints, rawDiscount);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordRedemptionForOrder(Long customerId, Long orderId, RedemptionCalculation calc) {
        if (calc == null || calc.pointsRedeemed() <= 0) {
            return;
        }
        String key = "REDEEM:order:" + orderId;
        if (txRepo.findByIdempotencyKey(key).isPresent()) {
            return;
        }
        LoyaltyTransaction tx = new LoyaltyTransaction();
        tx.setCustomerId(customerId);
        tx.setOrderId(orderId);
        tx.setType(LoyaltyTransactionType.REDEEM);
        tx.setPoints(-calc.pointsRedeemed());
        tx.setRupeeValue(calc.discountAmount());
        tx.setIdempotencyKey(key);
        tx.setDescription("Redeemed on Order #" + orderId);
        tx.setCreatedAt(nowIst());
        txRepo.save(tx);
    }

    /**
     * Computes eligible order amount for earning points:
     * {@code eligibleAmount = max(0, (finalTotal != null ? finalTotal : estimatedTotal) - deliveryFee)}.
     * Because {@code finalTotal}/{@code estimatedTotal} is already net of any {@code loyaltyDiscountAmount},
     * this excludes delivery charges and ensures redeemed discounts are never double-counted.
     */
    public static BigDecimal eligibleOrderAmount(CustomerOrder order) {
        if (order == null) return BigDecimal.ZERO;
        BigDecimal total = order.getFinalTotal() != null ? order.getFinalTotal() : order.getEstimatedTotal();
        if (total == null) return BigDecimal.ZERO;
        BigDecimal fee = order.getDeliveryFee() != null ? order.getDeliveryFee() : BigDecimal.ZERO;
        BigDecimal eligible = total.subtract(fee);
        return eligible.signum() > 0 ? eligible : BigDecimal.ZERO;
    }

    @Transactional
    public int awardForDeliveredOrder(CustomerOrder order) {
        if (order == null || order.getId() == null) return 0;
        LoyaltySettings s = loadOrDefaultSettings();
        if (!s.isEnabled() || s.getPointsPer100Inr().signum() <= 0) {
            return 0;
        }
        String key = "EARN:order:" + order.getId();
        if (txRepo.findByIdempotencyKey(key).isPresent()) {
            return 0;
        }

        BigDecimal eligible = eligibleOrderAmount(order);
        int earned = eligible
                .multiply(s.getPointsPer100Inr())
                .divide(HUNDRED, 0, RoundingMode.FLOOR)
                .intValue();
        if (earned <= 0) {
            return 0;
        }

        LocalDateTime now = nowIst();
        LoyaltyTransaction tx = new LoyaltyTransaction();
        tx.setCustomerId(order.getCustomerId());
        tx.setOrderId(order.getId());
        tx.setType(LoyaltyTransactionType.EARN);
        tx.setPoints(earned);
        tx.setRupeeValue(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        tx.setIdempotencyKey(key);
        tx.setDescription("Earned from delivered Order #" + order.getId());
        if (s.getExpiryDays() != null && s.getExpiryDays() > 0) {
            tx.setExpiresAt(now.plusDays(s.getExpiryDays()));
        }
        tx.setCreatedAt(now);
        txRepo.save(tx);
        return earned;
    }

    @Transactional
    public void reverseForCancelledOrder(CustomerOrder order) {
        if (order == null || order.getId() == null) return;
        List<LoyaltyTransaction> orderTxs = txRepo.findByOrderIdOrderByIdAsc(order.getId());
        if (orderTxs.isEmpty()) return;

        LocalDateTime now = nowIst();
        for (LoyaltyTransaction orig : orderTxs) {
            if (orig.getType() == LoyaltyTransactionType.REDEEM) {
                String revKey = "REVERSAL:REDEEM:order:" + order.getId();
                if (txRepo.findByIdempotencyKey(revKey).isEmpty()) {
                    LoyaltyTransaction rev = new LoyaltyTransaction();
                    rev.setCustomerId(order.getCustomerId());
                    rev.setOrderId(order.getId());
                    rev.setType(LoyaltyTransactionType.REFUND_REVERSAL);
                    rev.setPoints(Math.abs(orig.getPoints()));
                    rev.setRupeeValue(orig.getRupeeValue());
                    rev.setIdempotencyKey(revKey);
                    rev.setDescription("Returned redeemed points for cancelled Order #" + order.getId());
                    rev.setCreatedAt(now);
                    txRepo.save(rev);
                }
            } else if (orig.getType() == LoyaltyTransactionType.EARN) {
                String revKey = "REVERSAL:EARN:order:" + order.getId();
                if (txRepo.findByIdempotencyKey(revKey).isEmpty()) {
                    long currentBal = Math.max(0L, txRepo.sumActivePointsForCustomer(order.getCustomerId(), now));
                    int deduct = (int) Math.min(currentBal, orig.getPoints());
                    if (deduct > 0) {
                        LoyaltyTransaction rev = new LoyaltyTransaction();
                        rev.setCustomerId(order.getCustomerId());
                        rev.setOrderId(order.getId());
                        rev.setType(LoyaltyTransactionType.REFUND_REVERSAL);
                        rev.setPoints(-deduct);
                        rev.setRupeeValue(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                        rev.setIdempotencyKey(revKey);
                        rev.setDescription("Reversed earned points for cancelled Order #" + order.getId());
                        rev.setCreatedAt(now);
                        txRepo.save(rev);
                    }
                }
            }
        }
    }

    @Transactional(readOnly = true)
    public LoyaltyAnalyticsSummary analyticsSummary(LocalDateTime from, LocalDateTime to) {
        long issued = txRepo.sumPointsByTypeBetween(LoyaltyTransactionType.EARN, from, to);
        long redeemedNeg = txRepo.sumPointsByTypeBetween(LoyaltyTransactionType.REDEEM, from, to);
        long redeemed = Math.abs(redeemedNeg);
        long liability = Math.max(0L, txRepo.sumTotalOutstandingPoints(nowIst()));
        long redemptionOrders = txRepo.countDistinctOrdersByTypeBetween(LoyaltyTransactionType.REDEEM, from, to);
        return new LoyaltyAnalyticsSummary(issued, redeemed, liability, redemptionOrders);
    }

    private LoyaltySettings loadOrDefaultSettings() {
        return settingsRepo.findById(1L).orElseGet(LoyaltySettings::new);
    }

    private LocalDateTime nowIst() {
        return LocalDateTime.now(clock.withZone(IST));
    }
}
