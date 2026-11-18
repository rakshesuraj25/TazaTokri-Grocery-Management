package com.tazatokri.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AddressRequest(
        @NotBlank @Size(max = 30) String label,
        @NotBlank @Size(max = 150) String line1,
        @Size(max = 150) String line2,
        @Size(max = 100) String landmark,
        @NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "Pincode must be 6 digits") String pincode) {}