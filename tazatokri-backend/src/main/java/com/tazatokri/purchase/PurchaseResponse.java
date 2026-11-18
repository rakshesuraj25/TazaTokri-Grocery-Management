package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PurchaseResponse(Long id, Long supplierId, String supplierName,
        LocalDate purchaseDate, BigDecimal transportCost, BigDecimal totalCost,
        String note, Long createdBy, List<Item> items) {

    public record Item(Long vegetableId, String vegetableName, BigDecimal quantity,
            BigDecimal ratePerUnit, BigDecimal lineCost, BigDecimal transportShare,
            BigDecimal landedCostPerUnit) {}

    public static PurchaseResponse from(Purchase p, boolean withItems) {
        List<Item> items = withItems
                ? p.getItems().stream().map(i -> new Item(i.getVegetable().getId(),
                        i.getVegetable().getNameEn(), i.getQuantity(), i.getRatePerUnit(),
                        i.getLineCost(), i.getTransportShare(), i.getLandedCostPerUnit())).toList()
                : List.of();
        return new PurchaseResponse(p.getId(), p.getSupplier().getId(), p.getSupplier().getName(),
                p.getPurchaseDate(), p.getTransportCost(), p.getTotalCost(),
                p.getNote(), p.getCreatedBy(), items);
    }
}