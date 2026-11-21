package com.tazatokri.report;

import java.time.LocalDate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

	private final ReportService service;
	private final BusinessAnalyticsService analyticsService;
	private final BusinessOverviewService overviewService;

	public ReportController(ReportService service) {
		this(service, null, null);
	}

	public ReportController(ReportService service, BusinessAnalyticsService analyticsService) {
		this(service, analyticsService, null);
	}

	@Autowired
	public ReportController(ReportService service,
			BusinessAnalyticsService analyticsService,
			BusinessOverviewService overviewService) {
		this.service = service;
		this.analyticsService = analyticsService;
		this.overviewService = overviewService;
	}

	@GetMapping("/daily")
	@PreAuthorize("hasRole('OWNER')")
	public DailyReport daily(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		return service.daily(date);
	}

	@GetMapping("/wastage")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public WastageReport wastage(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		return service.wastage(date);
	}

	@GetMapping("/intelligence")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public BusinessIntelligenceReport intelligence(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
		return service.intelligence(from, to);
	}

	@GetMapping("/analytics")
	@PreAuthorize("hasRole('OWNER')")
	public BusinessAnalyticsService.BusinessAnalyticsReport analytics(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
		return analyticsService.analytics(from, to);
	}

	@GetMapping("/overview")
	@PreAuthorize("hasRole('OWNER')")
	public BusinessOverviewService.BusinessOverviewResponse overview() {
		return overviewService.overview();
	}
}