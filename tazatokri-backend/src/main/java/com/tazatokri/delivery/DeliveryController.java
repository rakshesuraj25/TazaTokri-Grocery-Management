package com.tazatokri.delivery;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.payment.CollectionRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/delivery/orders")
@PreAuthorize("hasRole('DELIVERY')")
public class DeliveryController {

	private final DeliveryService service;

	public DeliveryController(DeliveryService service) {
		this.service = service;
	}

	@GetMapping
	public List<DeliveryOrderResponse> mine(Authentication auth) {
		return service.myOrders(auth.getName());
	}

	@PostMapping("/{id}/start")
	public AttemptResponse start(@PathVariable Long id, Authentication auth) {
		return service.start(id, auth.getName());
	}

    @PostMapping("/{id}/deliver")
    public AttemptResponse deliver(@PathVariable Long id,
                                   @Valid @RequestBody(required = false) CollectionRequest req,
                                   Authentication auth) {
        return service.deliver(id, req, auth.getName());
    }
	@PostMapping("/{id}/fail")
	public AttemptResponse fail(@PathVariable Long id, @Valid @RequestBody FailRequest req, Authentication auth) {
		return service.fail(id, req.reason(), auth.getName());
	}
}