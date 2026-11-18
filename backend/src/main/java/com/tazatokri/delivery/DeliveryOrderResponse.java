
package com.tazatokri.delivery;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.tazatokri.order.CustomerOrder;
import com.tazatokri.user.User;

public record DeliveryOrderResponse(
        Long orderId,
        DeliveryStatus deliveryStatus,
        LocalDate deliveryDate,
        String address,
        String pincode,
        String customerName,
        String customerPhone,
        com.tazatokri.order.OrderPaymentMethod paymentMethod,
        BigDecimal amountToCollect,
        List<Line> items) {

    public record Line(
            String vegetable,
            BigDecimal packedQuantity,
            String unit) {
    }

    public static DeliveryOrderResponse from(
            CustomerOrder o,
            DeliveryAttempt a,
            User customer,
            BigDecimal amountToCollect) {

        List<Line> lines = o.getItems().stream()
                .map(i -> new Line(
                        i.getVegetable().getNameEn(),
                        i.getActualQuantity(),
                        i.getVegetable().getBaseUnit().name()))
                .toList();

        return new DeliveryOrderResponse(
                o.getId(),
                a.getStatus(),
                o.getDeliveryDate(),
                o.getDeliveryAddress(),
                o.getDeliveryPincode(),
                customer.getFullName(),
                customer.getPhone(),
                o.getPaymentMethod(),
                amountToCollect,
                lines);
    }
}
