package com.tazatokri.delivery;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.delivery.RiderOperationsService.RiderSummaryDto;

@RestController
@RequestMapping("/api/delivery/riders")
@PreAuthorize("hasAnyRole('OWNER','STAFF')")
public class RiderOperationsController {

    private final RiderOperationsService service;

    public RiderOperationsController(RiderOperationsService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public List<RiderSummaryDto> summary() {
        return service.summarizeRiders();
    }

    @GetMapping("/{id}/history")
    public List<AttemptResponse> history(@PathVariable Long id) {
        return service.riderHistory(id);
    }
}
