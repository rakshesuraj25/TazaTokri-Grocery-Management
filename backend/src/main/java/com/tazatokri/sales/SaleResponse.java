package com.tazatokri.sales;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record SaleResponse(Long id, LocalDateTime createdAt, SalePaymentMethod paymentMethod,
        BigDecimal totalAmount, Long soldBy, List<Item> items) {

    public record Item(Long vegetableId, String vegetableName, BigDecimal quantity,
                       BigDecimal unitPrice, BigDecimal lineTotal) {}

    public static SaleResponse from(Sale s, boolean withItems) {
        List<Item> items = withItems
                ? s.getItems().stream().map(i -> new Item(i.getVegetable().getId(),
                        i.getVegetable().getNameEn(), i.getQuantity(),
                        i.getUnitPrice(), i.getLineTotal())).toList()
                : List.of();
        return new SaleResponse(s.getId(), s.getCreatedAt(), s.getPaymentMethod(),
                s.getTotalAmount(), s.getCreatedBy(), items);
    }
}