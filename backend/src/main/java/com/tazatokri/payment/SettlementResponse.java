package com.tazatokri.payment;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record SettlementResponse(Long deliveryUserId, BigDecimal amount,
                                 int payments, LocalDateTime settledAt) {}