package com.tazatokri.delivery;

import jakarta.validation.constraints.NotNull;

public record AssignRequest(@NotNull Long deliveryUserId) {}