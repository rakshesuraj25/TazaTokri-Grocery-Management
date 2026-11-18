package com.tazatokri.payment;

import java.math.BigDecimal;

public record PendingCashResponse(Long deliveryUserId, String fullName,
                                  BigDecimal amount, long payments) {}