package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PurchaseResponse(
        Long id,
        Long supplierId,
        String supplierName,
        LocalDate purchaseDate,
        String invoiceNumber,
        PurchaseStatus status,
        BigDecimal transportCost,
        BigDecimal totalCost,
        BigDecimal paidAmount,
        BigDecimal outstandingAmount,
        PurchasePaymentStatus paymentStatus,
        String note,
        LocalDateTime cancelledAt,
        String cancelReason,
        Long createdBy,
        LocalDateTime createdAt,
        List<Item> items) {

    public record Item(
            Long vegetableId,
            String vegetableName,
            String unit,
            BigDecimal quantity,
            BigDecimal ratePerUnit,
            BigDecimal lineCost,
            BigDecimal transportShare,
            BigDecimal landedCostPerUnit) {}

    public static PurchaseResponse from(Purchase p, boolean withItems) {
        return from(p, withItems, BigDecimal.ZERO);
    }

    public static PurchaseResponse from(Purchase p, boolean withItems, BigDecimal paidAmount) {
        BigDecimal total = p.getTotalCost() != null ? p.getTotalCost().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2);
        BigDecimal paid = paidAmount != null ? paidAmount.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2);
        BigDecimal outstanding = p.getStatus() == PurchaseStatus.CANCELLED
                ? BigDecimal.ZERO.setScale(2)
                : total.subtract(paid).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

        PurchasePaymentStatus payStatus;
        if (p.getStatus() == PurchaseStatus.CANCELLED) {
            payStatus = PurchasePaymentStatus.CANCELLED;
        } else if (paid.compareTo(BigDecimal.ZERO) <= 0) {
            payStatus = PurchasePaymentStatus.UNPAID;
        } else if (outstanding.compareTo(BigDecimal.ZERO) <= 0) {
            payStatus = PurchasePaymentStatus.PAID;
        } else {
            payStatus = PurchasePaymentStatus.PARTIAL;
        }

        List<Item> items = withItems
                ? p.getItems().stream().map(i -> new Item(
                        i.getVegetable().getId(),
                        i.getVegetable().getNameEn(),
                        i.getVegetable().getBaseUnit() != null ? i.getVegetable().getBaseUnit().name() : null,
                        i.getQuantity(),
                        i.getRatePerUnit(),
                        i.getLineCost(),
                        i.getTransportShare(),
                        i.getLandedCostPerUnit())).toList()
                : List.of();

        return new PurchaseResponse(
                p.getId(),
                p.getSupplier().getId(),
                p.getSupplier().getName(),
                p.getPurchaseDate(),
                p.getInvoiceNumber(),
                p.getStatus(),
                p.getTransportCost(),
                total,
                paid,
                outstanding,
                payStatus,
                p.getNote(),
                p.getCancelledAt(),
                p.getCancelReason(),
                p.getCreatedBy(),
                p.getCreatedAt(),
                items);
    }
}
