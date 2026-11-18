package com.tazatokri.pricing;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/pricing")
public class PricingController {

    private final PricingService service;
    public PricingController(PricingService service) { this.service = service; }

    public record SetPriceRequest(
            @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal pricePerUnit,
            @Size(max = 255) String note) {}

    @GetMapping("/current")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<PriceResponse> current() { return service.currentPrices(); }

    @PutMapping("/vegetables/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public PriceResponse set(@PathVariable Long id, @Valid @RequestBody SetPriceRequest req,
                             Authentication auth) {
        return service.setPrice(id, req.pricePerUnit(), req.note(), PriceSource.MANUAL, auth.getName());
    }

    @GetMapping("/vegetables/{id}/history")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<PriceResponse> history(@PathVariable Long id,
                                       @RequestParam(defaultValue = "0") int page) {
        return service.history(id, page);
    }

    @GetMapping("/vegetables/{id}/suggestion")
    @PreAuthorize("hasRole('OWNER')")
    public SuggestionResponse suggestion(@PathVariable Long id) { return service.suggest(id); }

    @PostMapping("/vegetables/{id}/apply-suggestion")
    @PreAuthorize("hasRole('OWNER')")
    @ResponseStatus(HttpStatus.CREATED)
    public PriceResponse apply(@PathVariable Long id, Authentication auth) {
        return service.applySuggestion(id, auth.getName());
    }

    public record MarkdownPriceRequest(
            @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal markdownPricePerUnit,
            @Size(max = 180) String reason) {}

    @PostMapping("/vegetables/{id}/markdown")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public PriceResponse applyMarkdown(@PathVariable Long id,
                                       @Valid @RequestBody MarkdownPriceRequest req,
                                       Authentication auth) {
        return service.applyMarkdown(id, req.markdownPricePerUnit(), req.reason(), auth.getName());
    }
}