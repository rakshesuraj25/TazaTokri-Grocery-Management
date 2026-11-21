package com.tazatokri.loyalty;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.loyalty.LoyaltyService.CustomerLoyaltyDto;
import com.tazatokri.loyalty.LoyaltyService.LoyaltySettingsDto;
import com.tazatokri.loyalty.LoyaltyService.UpdateLoyaltySettingsRequest;

@RestController
public class LoyaltyController {

    private final LoyaltyService service;

    public LoyaltyController(LoyaltyService service) {
        this.service = service;
    }

    @GetMapping("/api/loyalty/settings")
    public LoyaltySettingsDto publicSettings() {
        return service.getSettings();
    }

    @GetMapping("/api/my/loyalty")
    public CustomerLoyaltyDto myLoyalty(Authentication auth) {
        return service.getCustomerLoyalty(auth.getName());
    }

    @GetMapping("/api/owner/loyalty/settings")
    @PreAuthorize("hasRole('OWNER')")
    public LoyaltySettingsDto ownerSettings() {
        return service.getSettings();
    }

    @PutMapping("/api/owner/loyalty/settings")
    @PreAuthorize("hasRole('OWNER')")
    public LoyaltySettingsDto updateOwnerSettings(
            @RequestBody UpdateLoyaltySettingsRequest req,
            Authentication auth) {
        return service.updateSettings(req, auth != null ? auth.getName() : "OWNER");
    }
}
