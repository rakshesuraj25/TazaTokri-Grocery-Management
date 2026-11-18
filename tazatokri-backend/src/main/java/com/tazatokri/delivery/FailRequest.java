package com.tazatokri.delivery;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FailRequest(@NotBlank(message = "A reason is required") @Size(max = 255) String reason) {
}