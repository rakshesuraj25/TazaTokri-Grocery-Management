package com.tazatokri.inventory;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventory/insights")
@PreAuthorize("hasRole('OWNER')")
public class InventoryInsightsController {

    private final InventoryInsightsService service;

    public InventoryInsightsController(InventoryInsightsService service) {
        this.service = service;
    }

    @GetMapping
    public InventoryInsightsService.InventoryInsightsDashboard dashboard(
            @RequestParam(defaultValue = "7") int horizonDays) {
        return service.getDashboard(horizonDays);
    }

    @GetMapping("/{vegetableId}")
    public InventoryInsightsService.ProductDemandInsight productInsight(
            @PathVariable Long vegetableId,
            @RequestParam(defaultValue = "7") int horizonDays) {
        return service.getProductInsight(vegetableId, horizonDays);
    }
}
