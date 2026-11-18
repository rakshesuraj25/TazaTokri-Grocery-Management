
package com.tazatokri.order;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/customer/orders")
@PreAuthorize("hasRole('CUSTOMER')")
public class CustomerOrderController {

    private final OrderService service;
    private final OrderFlowService flow;

    public CustomerOrderController(
            OrderService service,
            OrderFlowService flow) {
        this.service = service;
        this.flow = flow;
    }

    // 1. Place a new order
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse place(
            @Valid @RequestBody PlaceOrderRequest req,
            Authentication auth) {

        return service.place(req, auth.getName());
    }

    // 2. Get customer's order list
    @GetMapping
    public List<OrderResponse> list(
            Authentication auth,
            @RequestParam(defaultValue = "0") int page) {

        return service.list(auth.getName(), page);
    }

    // 3. Get order details by ID
    @GetMapping("/{id}")
    public OrderResponse get(
            @PathVariable Long id,
            Authentication auth) {

        return service.get(id, auth.getName());
    }

    // 4. Cancel customer's order
    @PostMapping("/{id}/cancel")
    public OrderResponse cancel(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) CancelRequest req,
            Authentication auth) {

        return flow.cancelByCustomer(
                id,
                req == null ? null : req.reason(),
                auth.getName()
        );
    }

    public record UpdateInstructionsRequest(@Size(max = 255) String deliveryInstructions) {}

    // 5. Edit delivery instructions before order packing cutoff
    @PatchMapping("/{id}/delivery-instructions")
    public OrderResponse updateInstructions(
            @PathVariable Long id,
            @Valid @RequestBody UpdateInstructionsRequest req,
            Authentication auth) {
        return service.updateDeliveryInstructions(
                id,
                req == null ? null : req.deliveryInstructions(),
                auth.getName());
    }
}
