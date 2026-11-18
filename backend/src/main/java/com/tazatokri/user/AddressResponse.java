package com.tazatokri.user;

public record AddressResponse(Long id, String label, String line1, String line2, String landmark, String pincode,
		boolean defaultAddress) {
	public static AddressResponse from(Address a) {
		return new AddressResponse(a.getId(), a.getLabel(), a.getLine1(), a.getLine2(), a.getLandmark(), a.getPincode(),
				a.isDefaultAddress());
	}
}