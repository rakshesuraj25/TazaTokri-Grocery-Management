package com.tazatokri.delivery;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DeliveryRules {

    private final Set<String> pincodes;
    private final BigDecimal minOrder;
    private final BigDecimal fee;
    private final BigDecimal freeAbove;
    private final LocalTime cutoff;

    public DeliveryRules(@Value("${app.delivery.pincodes}") List<String> pincodes,
                         @Value("${app.delivery.min-order}") BigDecimal minOrder,
                         @Value("${app.delivery.fee}") BigDecimal fee,
                         @Value("${app.delivery.free-above}") BigDecimal freeAbove,
                         @Value("${app.delivery.cutoff-time}") String cutoff) {
        this.pincodes = new HashSet<>(pincodes.stream().map(String::trim).toList());
        this.minOrder = minOrder;
        this.fee = fee;
        this.freeAbove = freeAbove;
        this.cutoff = LocalTime.parse(cutoff);
    }

    public boolean isServiceable(String pincode) {
        return pincodes.contains(pincode);
    }

    public BigDecimal minOrder() {
        return minOrder;
    }

    public BigDecimal feeFor(BigDecimal subtotal) {
        return subtotal.compareTo(freeAbove) > 0 ? BigDecimal.ZERO : fee;
    
    }

    public LocalDate deliveryDateFor(LocalDateTime orderedAt) {
        return orderedAt.toLocalTime().isBefore(cutoff)
                ? orderedAt.toLocalDate()
                : orderedAt.toLocalDate().plusDays(1);
    }
}