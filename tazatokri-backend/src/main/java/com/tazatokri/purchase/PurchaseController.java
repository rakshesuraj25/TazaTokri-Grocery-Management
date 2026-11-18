package com.tazatokri.purchase;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/purchases")
public class PurchaseController {

	private final PurchaseService service;

	public PurchaseController(PurchaseService service) {
		this.service = service;
	}

	@PostMapping
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	@ResponseStatus(HttpStatus.CREATED)
	public PurchaseResponse create(@Valid @RequestBody PurchaseRequest req, Authentication auth) {
		return service.create(req, auth.getName());
	}

	@GetMapping
	@PreAuthorize("hasRole('OWNER')")
	public List<PurchaseResponse> list(@RequestParam(defaultValue = "0") int page) {
		return service.list(page);
	}

	@GetMapping("/{id}")
	@PreAuthorize("hasRole('OWNER')")
	public PurchaseResponse get(@PathVariable Long id) {
		return service.get(id);
	}
}