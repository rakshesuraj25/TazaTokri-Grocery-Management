package com.tazatokri.order;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record OrderResponse(Long id, OrderStatus status, OrderPaymentMethod paymentMethod,
        LocalDate deliveryDate, String deliveryAddress, String deliveryPincode,
        String deliveryInstructions,
        BigDecimal subtotal, BigDecimal deliveryFee, BigDecimal estimatedTotal,
        BigDecimal finalTotal, LocalDateTime createdAt, List<Item> items) {

    public OrderResponse(Long id, OrderStatus status, OrderPaymentMethod paymentMethod,
            LocalDate deliveryDate, String deliveryAddress, String deliveryPincode,
            BigDecimal subtotal, BigDecimal deliveryFee, BigDecimal estimatedTotal,
            BigDecimal finalTotal, LocalDateTime createdAt, List<Item> items) {
        this(id, status, paymentMethod, deliveryDate, deliveryAddress, deliveryPincode, null,
                subtotal, deliveryFee, estimatedTotal, finalTotal, createdAt, items);
    }

    public record Item(Long vegetableId, String vegetableName, BigDecimal quantity,
            BigDecimal unitPrice, BigDecimal estimatedLineTotal,
            BigDecimal actualQuantity, BigDecimal finalLineTotal) {}

    public static OrderResponse from(CustomerOrder o, boolean withItems) {
        List<Item> items = withItems
                ? o.getItems().stream().map(i -> new Item(i.getVegetable().getId(),
                        i.getVegetable().getNameEn(), i.getQuantity(), i.getUnitPrice(),
                        i.getEstimatedLineTotal(), i.getActualQuantity(),
                        i.getFinalLineTotal())).toList()
                : List.of();
        return new OrderResponse(o.getId(), o.getStatus(), o.getPaymentMethod(),
                o.getDeliveryDate(), o.getDeliveryAddress(), o.getDeliveryPincode(),
                o.getDeliveryInstructions(),
                o.getSubtotal(), o.getDeliveryFee(), o.getEstimatedTotal(),
                o.getFinalTotal(), o.getCreatedAt(), items);
    }
}
