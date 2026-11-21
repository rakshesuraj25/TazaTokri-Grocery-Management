package com.tazatokri.delivery;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

@RestController
public class StoreSettingsController {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    public record StoreSettingsDto(
            List<String> pincodes,
            BigDecimal minOrder,
            BigDecimal deliveryFee,
            BigDecimal freeDeliveryAbove,
            String cutoffTime,
            boolean storeOpen) {
        static StoreSettingsDto from(DeliveryRules.Snapshot s) {
            return new StoreSettingsDto(
                    s.pincodes(),
                    s.minOrder(),
                    s.fee(),
                    s.freeAbove(),
                    s.cutoff().format(TIME_FMT),
                    s.storeOpen());
        }
    }

    public record UpdateStoreSettingsRequest(
            @NotEmpty(message = "At least one serviceable PIN code is required")
            List<@NotBlank(message = "PIN code cannot be blank") String> pincodes,

            @NotNull(message = "Minimum order amount is required")
            @DecimalMin(value = "0", message = "Minimum order amount cannot be negative")
            BigDecimal minOrder,

            @NotNull(message = "Delivery fee is required")
            @DecimalMin(value = "0", message = "Delivery fee cannot be negative")
            BigDecimal deliveryFee,

            @NotNull(message = "Free-delivery threshold is required")
            @DecimalMin(value = "0", message = "Free-delivery threshold cannot be negative")
            BigDecimal freeDeliveryAbove,

            @NotBlank(message = "Cutoff time is required")
            String cutoffTime,

            boolean storeOpen) {}

    private final DeliveryRules rules;

    public StoreSettingsController(DeliveryRules rules) {
        this.rules = rules;
    }

    @GetMapping("/api/owner/settings")
    @PreAuthorize("hasRole('OWNER')")
    public StoreSettingsDto getOwnerSettings() {
        return StoreSettingsDto.from(rules.getSnapshot());
    }

    @PutMapping("/api/owner/settings")
    @PreAuthorize("hasRole('OWNER')")
    public StoreSettingsDto updateOwnerSettings(@Valid @RequestBody UpdateStoreSettingsRequest req) {
        DeliveryRules.Snapshot updated = rules.updateSettings(
                req.pincodes(),
                req.minOrder(),
                req.deliveryFee(),
                req.freeDeliveryAbove(),
                req.cutoffTime(),
                req.storeOpen());
        return StoreSettingsDto.from(updated);
    }

    @GetMapping("/api/public/store-settings")
    public StoreSettingsDto getPublicSettings() {
        return StoreSettingsDto.from(rules.getSnapshot());
    }
}
