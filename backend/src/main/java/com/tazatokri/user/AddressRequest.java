package com.tazatokri.user;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AddressRequest(
		@NotBlank @Size(max = 30) String label,
		@NotBlank @Size(max = 150) String line1,
		@Size(max = 150) String line2,
		@Size(max = 100) String landmark,
		@NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "Pincode must be 6 digits") String pincode,
		@Size(max = 255) String deliveryInstructions,
		@DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
		@DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude) {

	public AddressRequest(String label, String line1, String line2, String landmark, String pincode) {
		this(label, line1, line2, landmark, pincode, null, null, null);
	}
}
