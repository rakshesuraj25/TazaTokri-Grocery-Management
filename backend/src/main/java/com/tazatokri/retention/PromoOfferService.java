package com.tazatokri.retention;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class PromoOfferService {

    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    public record PromoOfferRequest(
            String name,
            String code,
            String description,
            PromoDiscountType discountType,
            BigDecimal discountValue,
            BigDecimal minOrderAmount,
            BigDecimal maxDiscountAmount,
            LocalDateTime startsAt,
            LocalDateTime expiresAt,
            Integer maxTotalUses,
            int maxUsesPerCustomer,
            boolean enabled) {}

    public record PromoOfferDto(
            Long id,
            String name,
            String code,
            String description,
            PromoDiscountType discountType,
            BigDecimal discountValue,
            BigDecimal minOrderAmount,
            BigDecimal maxDiscountAmount,
            LocalDateTime startsAt,
            LocalDateTime expiresAt,
            Integer maxTotalUses,
            int maxUsesPerCustomer,
            boolean enabled,
            long totalUsed) {
        public static PromoOfferDto from(PromoOffer o, long used) {
            return new PromoOfferDto(
                    o.getId(),
                    o.getName(),
                    o.getCode(),
                    o.getDescription(),
                    o.getDiscountType(),
                    o.getDiscountValue(),
                    o.getMinOrderAmount(),
                    o.getMaxDiscountAmount(),
                    o.getStartsAt(),
                    o.getExpiresAt(),
                    o.getMaxTotalUses(),
                    o.getMaxUsesPerCustomer(),
                    o.isEnabled(),
                    used);
        }
    }

    public record PromoPreviewDto(
            String code,
            PromoDiscountType discountType,
            BigDecimal discountValue,
            BigDecimal discountAmount,
            String description) {}

    public record AppliedPromo(
            Long offerId,
            String code,
            BigDecimal discountAmount) {}

    private final PromoOfferRepository offers;
    private final PromoRedemptionRepository redemptions;
    private final UserRepository users;
    private final Clock clock;

    public PromoOfferService(
            PromoOfferRepository offers,
            PromoRedemptionRepository redemptions,
            UserRepository users) {
        this(offers, redemptions, users, Clock.system(IST));
    }

    @Autowired
    public PromoOfferService(
            PromoOfferRepository offers,
            PromoRedemptionRepository redemptions,
            UserRepository users,
            Clock clock) {
        this.offers = offers;
        this.redemptions = redemptions;
        this.users = users;
        this.clock = clock != null ? clock : Clock.system(IST);
    }

    @Transactional(readOnly = true)
    public List<PromoOfferDto> listOffers() {
        return offers.findAllByOrderByCreatedAtDescIdDesc().stream()
                .map(o -> PromoOfferDto.from(o, redemptions.countByOfferId(o.getId())))
                .toList();
    }

    @Transactional
    public PromoOfferDto createOffer(PromoOfferRequest req, String ownerPhone) {
        String normalizedCode = normalizeAndValidate(req);
        if (offers.findByCodeIgnoreCase(normalizedCode).isPresent()) {
            throw new DuplicateResourceException("Promo code already exists: " + normalizedCode);
        }
        Long ownerId = users.findByPhone(ownerPhone).map(User::getId).orElse(null);

        PromoOffer offer = new PromoOffer();
        applyFields(offer, req, normalizedCode);
        offer.setCreatedBy(ownerId);
        offer.setCreatedAt(nowIst());
        offer.setUpdatedAt(nowIst());

        PromoOffer saved = offers.save(offer);
        return PromoOfferDto.from(saved, 0L);
    }

    @Transactional
    public PromoOfferDto updateOffer(Long id, PromoOfferRequest req) {
        PromoOffer offer = offers.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Promo offer not found: " + id));
        String normalizedCode = normalizeAndValidate(req);
        offers.findByCodeIgnoreCase(normalizedCode)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new DuplicateResourceException("Promo code already exists: " + normalizedCode);
                });

        applyFields(offer, req, normalizedCode);
        offer.setUpdatedAt(nowIst());
        PromoOffer saved = offers.save(offer);
        return PromoOfferDto.from(saved, redemptions.countByOfferId(saved.getId()));
    }

    @Transactional
    public PromoOfferDto toggleOffer(Long id, boolean enabled) {
        PromoOffer offer = offers.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Promo offer not found: " + id));
        offer.setEnabled(enabled);
        offer.setUpdatedAt(nowIst());
        PromoOffer saved = offers.save(offer);
        return PromoOfferDto.from(saved, redemptions.countByOfferId(saved.getId()));
    }

    @Transactional(readOnly = true)
    public PromoPreviewDto previewPromo(
            String rawCode,
            String customerPhone,
            BigDecimal subtotal,
            BigDecimal loyaltyDiscount) {
        Long customerId = users.findByPhone(customerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"))
                .getId();
        String code = normalizeCode(rawCode);
        PromoOffer offer = offers.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new BadRequestException("Invalid promo code"));
        BigDecimal discount = validateEligibilityAndComputeDiscount(
                offer, customerId, subtotal, loyaltyDiscount);
        return new PromoPreviewDto(
                offer.getCode(),
                offer.getDiscountType(),
                offer.getDiscountValue(),
                discount,
                offer.getDescription());
    }

    /**
     * Locks the {@link PromoOffer} row with PESSIMISTIC_WRITE inside the order transaction
     * so concurrent checkouts cannot exceed global or per-customer usage limits.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public AppliedPromo validateAndLockForOrder(
            String rawCode,
            Long customerId,
            BigDecimal subtotal,
            BigDecimal loyaltyDiscount) {
        String code = normalizeCode(rawCode);
        PromoOffer offer = offers.findByCodeIgnoreCaseForUpdate(code)
                .orElseThrow(() -> new BadRequestException("Invalid promo code: " + code));
        BigDecimal discount = validateEligibilityAndComputeDiscount(
                offer, customerId, subtotal, loyaltyDiscount);
        return new AppliedPromo(offer.getId(), offer.getCode(), discount);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordRedemption(AppliedPromo applied, Long customerId, Long orderId) {
        if (applied == null) return;
        if (redemptions.existsByOrderId(orderId)) {
            throw new DuplicateResourceException("Promo offer already redeemed for Order #" + orderId);
        }
        PromoRedemption r = new PromoRedemption();
        r.setOfferId(applied.offerId());
        r.setCustomerId(customerId);
        r.setOrderId(orderId);
        r.setDiscountAmount(applied.discountAmount());
        r.setCreatedAt(nowIst());
        redemptions.save(r);
    }

    @Transactional
    public void releaseRedemptionForCancelledOrder(Long orderId) {
        if (orderId == null) {
            return;
        }
        redemptions.findByOrderId(orderId).ifPresent(redemption -> {
            // Lock offer row so concurrent checkouts and cancellations serialize cleanly
            offers.findByIdForUpdate(redemption.getOfferId());
            redemptions.delete(redemption);
        });
    }

    private BigDecimal validateEligibilityAndComputeDiscount(
            PromoOffer offer,
            Long customerId,
            BigDecimal subtotal,
            BigDecimal loyaltyDiscount) {
        if (!offer.isEnabled()) {
            throw new BadRequestException("Promo code is currently disabled");
        }
        LocalDateTime now = nowIst();
        if (now.isBefore(offer.getStartsAt())) {
            throw new BadRequestException("Promo code is not active yet");
        }
        if (now.isAfter(offer.getExpiresAt())) {
            throw new BadRequestException("Promo code has expired");
        }
        BigDecimal safeSubtotal = subtotal != null ? subtotal : BigDecimal.ZERO;
        if (safeSubtotal.compareTo(offer.getMinOrderAmount()) < 0) {
            throw new BadRequestException("Minimum order of Rs "
                    + offer.getMinOrderAmount().toPlainString() + " required for this promo code");
        }

        if (offer.getMaxTotalUses() != null) {
            long totalUsed = redemptions.countByOfferId(offer.getId());
            if (totalUsed >= offer.getMaxTotalUses()) {
                throw new BadRequestException("Promo code usage limit has been reached");
            }
        }
        long customerUsed = redemptions.countByOfferIdAndCustomerId(offer.getId(), customerId);
        if (customerUsed >= offer.getMaxUsesPerCustomer()) {
            throw new BadRequestException("You have already used this promo code");
        }

        BigDecimal rawDiscount;
        if (offer.getDiscountType() == PromoDiscountType.PERCENTAGE) {
            rawDiscount = safeSubtotal
                    .multiply(offer.getDiscountValue())
                    .divide(HUNDRED, 2, RoundingMode.HALF_UP);
            if (offer.getMaxDiscountAmount() != null && rawDiscount.compareTo(offer.getMaxDiscountAmount()) > 0) {
                rawDiscount = offer.getMaxDiscountAmount();
            }
        } else {
            rawDiscount = offer.getDiscountValue();
        }

        BigDecimal loyalty = loyaltyDiscount != null ? loyaltyDiscount : BigDecimal.ZERO;
        BigDecimal maxAllowed = safeSubtotal.subtract(loyalty).max(BigDecimal.ZERO);
        return rawDiscount.min(maxAllowed).setScale(2, RoundingMode.HALF_UP);
    }

    private static String normalizeCode(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Promo code is required");
        }
        String code = raw.trim().toUpperCase(Locale.ROOT);
        if (code.length() > 32 || !code.matches("^[A-Z0-9_-]+$")) {
            throw new BadRequestException("Promo code may contain only letters, numbers, - and _");
        }
        return code;
    }

    private static String normalizeAndValidate(PromoOfferRequest req) {
        if (req == null) {
            throw new BadRequestException("Promo offer payload is required");
        }
        if (req.name() == null || req.name().isBlank()) {
            throw new BadRequestException("Offer name is required");
        }
        String code = normalizeCode(req.code());
        if (req.discountType() == null) {
            throw new BadRequestException("Discount type is required");
        }
        if (req.discountValue() == null || req.discountValue().signum() <= 0) {
            throw new BadRequestException("Discount value must be greater than 0");
        }
        if (req.discountType() == PromoDiscountType.PERCENTAGE
                && req.discountValue().compareTo(HUNDRED) > 0) {
            throw new BadRequestException("Percentage discount cannot exceed 100%");
        }
        if (req.minOrderAmount() == null || req.minOrderAmount().signum() < 0) {
            throw new BadRequestException("Minimum order amount cannot be negative");
        }
        if (req.maxDiscountAmount() != null && req.maxDiscountAmount().signum() <= 0) {
            throw new BadRequestException("Maximum discount amount must be greater than 0");
        }
        if (req.startsAt() == null || req.expiresAt() == null || !req.expiresAt().isAfter(req.startsAt())) {
            throw new BadRequestException("Expiry date must be after start date");
        }
        if (req.maxTotalUses() != null && req.maxTotalUses() < 1) {
            throw new BadRequestException("Max total uses must be at least 1");
        }
        if (req.maxUsesPerCustomer() < 1) {
            throw new BadRequestException("Per-customer usage limit must be at least 1");
        }
        return code;
    }

    private static void applyFields(PromoOffer offer, PromoOfferRequest req, String code) {
        offer.setName(req.name().trim());
        offer.setCode(code);
        offer.setDescription(req.description() == null || req.description().isBlank() ? null : req.description().trim());
        offer.setDiscountType(req.discountType());
        offer.setDiscountValue(req.discountValue().setScale(2, RoundingMode.HALF_UP));
        offer.setMinOrderAmount(req.minOrderAmount().setScale(2, RoundingMode.HALF_UP));
        offer.setMaxDiscountAmount(req.maxDiscountAmount() != null
                ? req.maxDiscountAmount().setScale(2, RoundingMode.HALF_UP)
                : null);
        offer.setStartsAt(req.startsAt());
        offer.setExpiresAt(req.expiresAt());
        offer.setMaxTotalUses(req.maxTotalUses());
        offer.setMaxUsesPerCustomer(req.maxUsesPerCustomer());
        offer.setEnabled(req.enabled());
    }

    private LocalDateTime nowIst() {
        return LocalDateTime.now(clock.withZone(IST));
    }
}
