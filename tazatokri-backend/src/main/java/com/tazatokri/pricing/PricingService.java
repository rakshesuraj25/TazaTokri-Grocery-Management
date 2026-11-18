package com.tazatokri.pricing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.purchase.PurchaseItemRepository;
import com.tazatokri.purchase.PurchaseItemRepository.CostSummary;
import com.tazatokri.user.UserRepository;

@Service
public class PricingService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final VegetablePriceRepository prices;
    private final PurchaseItemRepository purchaseItems;
    private final VegetableRepository vegetables;
    private final UserRepository users;
    private final int lookbackDays;
    private final BigDecimal wastagePercent;
    private final BigDecimal marginPercent;
    private final BigDecimal roundingStep;

    public PricingService(VegetablePriceRepository prices, PurchaseItemRepository purchaseItems,
                          VegetableRepository vegetables, UserRepository users,
                          @Value("${app.pricing.lookback-days}") int lookbackDays,
                          @Value("${app.pricing.wastage-percent}") BigDecimal wastagePercent,
                          @Value("${app.pricing.margin-percent}") BigDecimal marginPercent,
                          @Value("${app.pricing.rounding-step}") BigDecimal roundingStep) {
        if (wastagePercent.signum() < 0 || wastagePercent.compareTo(HUNDRED) >= 0
                || marginPercent.signum() < 0 || marginPercent.compareTo(HUNDRED) >= 0
                || roundingStep.signum() <= 0 || lookbackDays < 1) {
            throw new IllegalStateException("Invalid app.pricing.* settings");
        }
        this.prices = prices;
        this.purchaseItems = purchaseItems;
        this.vegetables = vegetables;
        this.users = users;
        this.lookbackDays = lookbackDays;
        this.wastagePercent = wastagePercent;
        this.marginPercent = marginPercent;
        this.roundingStep = roundingStep;
    }

    @Transactional(readOnly = true)
    public SuggestionResponse suggest(Long vegetableId) {
        Vegetable v = activeVegetable(vegetableId);
        LocalDate since = LocalDate.now().minusDays(lookbackDays);

        CostSummary s = purchaseItems.summarize(vegetableId, since);
        if (s == null || s.getTotalQty() == null || s.getTotalQty().signum() == 0) {
            throw new BadRequestException("No purchases in the last " + lookbackDays
                    + " days for " + v.getNameEn() + ". Set the price manually.");
        }

        BigDecimal avgCost = s.getTotalCost().divide(s.getTotalQty(), 4, RoundingMode.HALF_UP);

        BigDecimal wasteFactor = BigDecimal.ONE.subtract(wastagePercent.divide(HUNDRED, 6, RoundingMode.HALF_UP));
        BigDecimal marginFactor = BigDecimal.ONE.subtract(marginPercent.divide(HUNDRED, 6, RoundingMode.HALF_UP));

        BigDecimal costWithWastage = avgCost.divide(wasteFactor, 4, RoundingMode.HALF_UP);
        BigDecimal raw = costWithWastage.divide(marginFactor, 4, RoundingMode.HALF_UP);
        BigDecimal suggested = raw.divide(roundingStep, 0, RoundingMode.CEILING)
                .multiply(roundingStep).setScale(2, RoundingMode.HALF_UP);

        BigDecimal current = prices.findFirstByVegetableIdOrderByIdDesc(vegetableId)
                .map(VegetablePrice::getPricePerUnit).orElse(null);

        return new SuggestionResponse(v.getId(), v.getNameEn(), v.getBaseUnit(), lookbackDays,
                s.getTotalQty(), avgCost, wastagePercent, costWithWastage,
                marginPercent, suggested, current);
    }

    @Transactional
    public PriceResponse applySuggestion(Long vegetableId, String actorPhone) {
        SuggestionResponse s = suggest(vegetableId);
        return setPrice(vegetableId, s.suggestedPrice(), "Applied suggestion", PriceSource.SUGGESTED, actorPhone);
    }

    @Transactional
    public PriceResponse setPrice(Long vegetableId, BigDecimal price, String note,
                                  PriceSource source, String actorPhone) {
        Vegetable v = activeVegetable(vegetableId);
        Long userId = users.findByPhone(actorPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user")).getId();
        String cleanNote = (note == null || note.isBlank()) ? null : note.trim();
        VegetablePrice saved = prices.save(new VegetablePrice(v, price, source, cleanNote, userId));
        return PriceResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<PriceResponse> currentPrices() {
        return prices.findAllCurrent().stream().map(PriceResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PriceResponse> history(Long vegetableId, int page) {
        return prices.findByVegetableId(vegetableId,
                PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "id")))
                .map(PriceResponse::from).getContent();
    }

    private Vegetable activeVegetable(Long id) {
        Vegetable v = vegetables.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vegetable not found: " + id));
        if (!v.isActive()) {
            throw new BadRequestException("Vegetable is inactive");
        }
        return v;
    }
}