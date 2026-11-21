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
        @Valid List<OrderComboRequest> combos,
        @Min(0) Integer redeemPoints,
        @Size(max = 32) String promoCode) {

    public PlaceOrderRequest(
            String clientRef,
            Long addressId,
            OrderPaymentMethod paymentMethod,
            List<OrderItemRequest> items) {
        this(clientRef, addressId, paymentMethod, items, List.of(), null, null);
    }

    public PlaceOrderRequest(
            String clientRef,
            Long addressId,
            OrderPaymentMethod paymentMethod,
            List<OrderItemRequest> items,
            List<OrderComboRequest> combos) {
        this(clientRef, addressId, paymentMethod, items, combos, null, null);
    }

    public PlaceOrderRequest(
            String clientRef,
            Long addressId,
            OrderPaymentMethod paymentMethod,
            List<OrderItemRequest> items,
            List<OrderComboRequest> combos,
            Integer redeemPoints) {
        this(clientRef, addressId, paymentMethod, items, combos, redeemPoints, null);
    }

    public record OrderComboRequest(
            @NotNull Long comboId,
            @Min(1) @Max(10) int count) {}
}
