package com.tazatokri.user;

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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/customer/addresses")
@PreAuthorize("hasRole('CUSTOMER')")
public class CustomerAddressController {

	private final AddressService service;

	public CustomerAddressController(AddressService service) {
		this.service = service;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public AddressResponse create(@Valid @RequestBody AddressRequest req, Authentication auth) {
		return service.create(auth.getName(), req);
	}

	@PutMapping("/{id}")
	public AddressResponse update(@PathVariable Long id, @Valid @RequestBody AddressRequest req, Authentication auth) {
		return service.update(auth.getName(), id, req);
	}

	@GetMapping
	public List<AddressResponse> list(Authentication auth) {
		return service.list(auth.getName());
	}
}