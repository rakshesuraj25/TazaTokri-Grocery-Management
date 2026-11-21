package com.tazatokri.report;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.report.CashClosingService.CloseDayRequest;
import com.tazatokri.report.CashClosingService.ClosedRecord;
import com.tazatokri.report.CashClosingService.DailyCashTallyResponse;

@RestController
@RequestMapping("/api/owner/cash-closing")
@PreAuthorize("hasRole('OWNER')")
public class CashClosingController {

    private final CashClosingService service;

    public CashClosingController(CashClosingService service) {
        this.service = service;
    }

    @GetMapping
    public DailyCashTallyResponse getTally(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getTally(date);
    }

    @GetMapping("/history")
    public List<ClosedRecord> history() {
        return service.history();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DailyCashTallyResponse closeDay(
            @RequestBody CloseDayRequest req,
            Authentication auth) {
        return service.closeDay(req, auth != null ? auth.getName() : "OWNER");
    }
}
