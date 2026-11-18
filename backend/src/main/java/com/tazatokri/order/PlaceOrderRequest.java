package com.tazatokri.order;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PlaceOrderRequest(
        @NotBlank @Size(max = 40) String clientRef,
        @NotNull Long addressId,
        @NotNull OrderPaymentMethod paymentMethod,
        @Valid List<OrderItemRequest> items,
        @Valid List<OrderComboRequest> combos) {

    public PlaceOrderRequest(
            String clientRef,
            Long addressId,
            OrderPaymentMethod paymentMethod,
            List<OrderItemRequest> items) {
        this(clientRef, addressId, paymentMethod, items, List.of());
    }

    public record OrderComboRequest(
            @NotNull Long comboId,
            @Min(1) @Max(10) int count) {}
}
