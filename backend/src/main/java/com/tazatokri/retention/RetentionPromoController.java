package com.tazatokri.retention;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.retention.PromoOfferService.PromoOfferDto;
import com.tazatokri.retention.PromoOfferService.PromoOfferRequest;
import com.tazatokri.retention.PromoOfferService.PromoPreviewDto;
import com.tazatokri.retention.RetentionService.RetentionDashboardDto;

@RestController
public class RetentionPromoController {

    private final RetentionService retentionService;
    private final PromoOfferService promoService;

    public RetentionPromoController(
            RetentionService retentionService,
            PromoOfferService promoService) {
        this.retentionService = retentionService;
        this.promoService = promoService;
    }

    @GetMapping("/api/owner/retention/insights")
    @PreAuthorize("hasRole('OWNER')")
    public RetentionDashboardDto insights(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer inactiveDays,
            @RequestParam(required = false) BigDecimal highValueThreshold,
            @RequestParam(required = false) CustomerSegment segment,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "spend") String sortBy,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return retentionService.getInsights(
                from, to, inactiveDays, highValueThreshold, segment, search, sortBy, page, size);
    }

    @GetMapping("/api/owner/promos")
    @PreAuthorize("hasRole('OWNER')")
    public List<PromoOfferDto> listOffers() {
        return promoService.listOffers();
    }

    @PostMapping("/api/owner/promos")
    @PreAuthorize("hasRole('OWNER')")
    @ResponseStatus(HttpStatus.CREATED)
    public PromoOfferDto createOffer(
            @RequestBody PromoOfferRequest req,
            Authentication auth) {
        return promoService.createOffer(req, auth != null ? auth.getName() : "OWNER");
    }

    @PutMapping("/api/owner/promos/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public PromoOfferDto updateOffer(
            @PathVariable Long id,
            @RequestBody PromoOfferRequest req) {
        return promoService.updateOffer(id, req);
    }

    public record ToggleOfferRequest(boolean enabled) {}

    @PatchMapping("/api/owner/promos/{id}/status")
    @PreAuthorize("hasRole('OWNER')")
    public PromoOfferDto toggleOffer(
            @PathVariable Long id,
            @RequestBody ToggleOfferRequest req) {
        return promoService.toggleOffer(id, req != null && req.enabled());
    }

    @GetMapping("/api/promos/validate")
    public PromoPreviewDto validatePromo(
            @RequestParam String code,
            @RequestParam BigDecimal subtotal,
            @RequestParam(required = false, defaultValue = "0") BigDecimal loyaltyDiscount,
            Authentication auth) {
        return promoService.previewPromo(code, auth.getName(), subtotal, loyaltyDiscount);
    }
}
