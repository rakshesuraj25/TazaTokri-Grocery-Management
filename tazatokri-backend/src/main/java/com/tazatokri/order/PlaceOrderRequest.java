package com.tazatokri.order;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PlaceOrderRequest(
        @NotBlank @Size(max = 40) String clientRef,
        @NotNull Long addressId,
        @NotNull OrderPaymentMethod paymentMethod,
        @NotEmpty @Valid List<OrderItemRequest> items) {}