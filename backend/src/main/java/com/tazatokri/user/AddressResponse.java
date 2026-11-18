package com.tazatokri.user;

import java.math.BigDecimal;

public record AddressResponse(
		Long id,
		String label,
		String line1,
		String line2,
		String landmark,
		String pincode,
		boolean defaultAddress,
		String deliveryInstructions,
		BigDecimal latitude,
		BigDecimal longitude) {

	public AddressResponse(Long id, String label, String line1, String line2, String landmark, String pincode,
			boolean defaultAddress) {
		this(id, label, line1, line2, landmark, pincode, defaultAddress, null, null, null);
	}

	public static AddressResponse from(Address a) {
		return new AddressResponse(
				a.getId(),
				a.getLabel(),
				a.getLine1(),
				a.getLine2(),
				a.getLandmark(),
				a.getPincode(),
				a.isDefaultAddress(),
				a.getDeliveryInstructions(),
				a.getLatitude(),
				a.getLongitude());
	}
}
